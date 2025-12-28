import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IInterview, InterviewService } from '../../services/interview/interview';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { Auth } from '../../services/auth/auth';
import { catchError, EMPTY, interval, Subscription, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface Question {
  id: number;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-interview',
  imports: [FormsModule, CommonModule],
  templateUrl: './interview.html',
  styleUrl: './interview.css',
  standalone: true,
})
export class Interview implements OnDestroy {
  isInterviewActive = false;
  isListening = false;
  elapsedTime = 0; // in seconds
  questions: Question[] = [];
  currentTranscription = '';
  isProcessing = false;
  isGeneratingAnswer = false;
  resumeFile: File | null = null;
  resumeUploaded = false;
  resumeText = '';
  jobDescription = '';
  userTier!: string;
  remainingMinutes: number = 0;

  apiUrl = environment.apiUrl;
  webSocketUrl = environment.websockerUrl;

  private ws: WebSocket | null = null;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  private intervalId: any;
  private interviewSaved = false;
  private heartbeatSub?: Subscription;

  constructor(
    private router: Router,
    private interviewService: InterviewService,
    private toaster: ToastrService,
    private authService: Auth,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.getUserTier();
  }

  // ==================== RESUME UPLOAD ====================
  async onResumeSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    this.resumeFile = file;
    this.isProcessing = true;
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const response = await fetch(`${this.apiUrl}/upload-resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload resume');
      const data = await response.json();
      this.resumeText = data.text;
      this.resumeUploaded = true;
      this.toaster.success('Resume uploaded successfully');
    } catch (error: any) {
      alert(`Failed to upload resume: ${error.message}`);
      this.resumeFile = null;
    } finally {
      this.isProcessing = false;
    }
  }

  // ==================== START INTERVIEW ====================
  async startInterview() {
    if (!this.resumeUploaded) {
      alert('Please upload your resume first');
      return;
    }

    this.isInterviewActive = true;
    this.startTimer();
    this.startListening();
    this.startHeartBeat();

    // WebSocket for real-time transcription
    this.ws = new WebSocket(this.webSocketUrl);
    this.ws.onopen = () => console.log('WebSocket connected for transcription');
    this.ws.onmessage = (e) => this.handleServerMessage(JSON.parse(e.data));
    this.ws.onerror = () => alert('WebSocket connection failed');
    this.ws.onclose = () => console.log('WebSocket closed');
  }

  // ==================== AUDIO CAPTURE ====================
  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.startRealtimeAudioCapture();
  }

  stopListening() {
    this.isListening = false;
    this.stopRealtimeAudioCapture();
  }

  async startRealtimeAudioCapture() {
    try {
      let stream: MediaStream;

      // Electron desktop capture support
      if ((window as any).electronAPI?.getAudioSources) {
        if ((window as any).electronAPI.requestAudioPermission) {
          const granted = await (window as any).electronAPI.requestAudioPermission();
          if (!granted) throw new Error('Audio permission denied');
        }

        const sources = await (window as any).electronAPI.getAudioSources();
        if (sources.length === 0) throw new Error('No audio sources available');

        const audioSource = sources[0];

        const desktopStream = await (navigator.mediaDevices as any).getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: audioSource.id,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: audioSource.id,
              maxWidth: 1,
              maxHeight: 1,
            },
          },
        });

        const audioTracks = desktopStream.getAudioTracks();
        if (audioTracks.length === 0) throw new Error('No audio track captured');

        stream = new MediaStream(audioTracks);
        desktopStream.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop());
      } else {
        // Browser microphone
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.stream = stream;

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio-chunk',
              audio: base64,
            })
          );
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
    } catch (error: any) {
      alert(`Audio error: ${error.message}`);
      this.isListening = false;
    }
  }

  private stopRealtimeAudioCapture() {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  // ==================== TRANSCRIPTION HANDLING ====================
  handleServerMessage(data: any) {
    switch (data.type) {
      case 'transcription-delta':
        this.currentTranscription += data.text;
        break;
      case 'transcription':
        this.currentTranscription = data.text;
        break;
      case 'error':
        alert(`Transcription error: ${data.message}`);
        break;
    }
  }

  // ==================== GENERATE ANSWER ====================
  async answerWithAI() {
    const transcription = this.currentTranscription.trim();
    if (!transcription) {
      alert('No question transcribed yet');
      return;
    }
    if (this.isGeneratingAnswer) return;

    this.isGeneratingAnswer = true;
    this.stopListening();

    try {
      const response = await fetch(`${this.apiUrl}/generate-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          question: transcription,
          resumeText: this.resumeText,
          jobDescription: this.jobDescription,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate answer');
      }

      const data = await response.json();
      this.addQuestion(data.question, data.answer);
      this.currentTranscription = '';
    } catch (error: any) {
      alert('Error generating answer: ' + error.message);
    } finally {
      this.isGeneratingAnswer = false;
      this.startListening();
    }
  }

  addQuestion(question: string, answer: string) {
    this.questions.push({
      id: this.questions.length + 1,
      question: question.trim(),
      answer: answer.trim(),
    });
  }

  // ==================== TIMER ====================
  startTimer() {
    this.intervalId = setInterval(() => this.elapsedTime++, 1000);
  }

  stopTimer() {
    clearInterval(this.intervalId);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  // ==================== HEARTBEAT (every 60s) ====================
  private startHeartBeat(): void {
    if (this.heartbeatSub || !this.isInterviewActive) return;

    this.heartbeatSub = interval(60_000) // every minute
      .pipe(
        switchMap(() =>
          this.http
            .post<{ remainingMinutes: number; consumedMinutes: number; message: string }>(
              `${this.apiUrl}/heartbeat`,
              {}
            )
            .pipe(
              catchError((err) => {
                if (err.status === 403 || err.status === 402) {
                  this.forceEndInterview('Your interview time has expired.');
                }
                return EMPTY;
              })
            )
        )
      )
      .subscribe((res) => {
        this.remainingMinutes = res.remainingMinutes;

        if (res.remainingMinutes <= 0) {
          this.forceEndInterview('Time limit reached.');
        }
      });
  }

  private stopHeartbeat(): void {
    this.heartbeatSub?.unsubscribe();
    this.heartbeatSub = undefined;
  }

  // ==================== END INTERVIEW ====================
  endInterview() {
    if (this.interviewSaved) return;
    this.interviewSaved = true;

    this.isListening = false;
    this.isInterviewActive = false;
    this.stopTimer();
    this.stopRealtimeAudioCapture();
    this.ws?.close();
    this.stopHeartbeat();

    // Deduct remaining partial minute (e.g., 0–59 seconds of current minute)
    const secondsInCurrentMinute = this.elapsedTime % 60;
    if (secondsInCurrentMinute > 0) {
      const partialMinutes = secondsInCurrentMinute / 60;
      this.deductPartialTime(partialMinutes);
    }

    this.createInterview();
    this.cleanupInterviewState();
  }

  private deductPartialTime(partialMinutes: number) {
    this.http
      .post(`${this.apiUrl}/deduct-partial`, {
        partialMinutes: Number(partialMinutes.toFixed(4)),
      })
      .subscribe({
        next: () => console.log('Partial time deducted successfully'),
        error: (err) => {
          console.error('Failed to deduct partial time', err);
          if (err.status === 403) this.router.navigate(['/pricing']);
        },
      });
  }

  private forceEndInterview(reason: string) {
    this.toaster.warning(reason);
    this.isInterviewActive = false;
    this.isListening = false;
    this.stopTimer();
    this.stopRealtimeAudioCapture();
    this.ws?.close();
    this.stopHeartbeat();
    this.cleanupInterviewState();
    this.router.navigate(['/pricing']);
  }

  private cleanupInterviewState() {
    this.ws = null;
    this.questions = [];
    this.currentTranscription = '';
    this.jobDescription = '';
    this.elapsedTime = 0;
    this.resumeUploaded = false;
    this.resumeText = '';
  }

  createInterview() {
    const interviewInfo: IInterview = {
      date: new Date().toISOString(),
      timeTaken: this.elapsedTime,
    };
    this.interviewService.createInterview(interviewInfo).subscribe({
      next: (response) => {
        if (response) this.toaster.info(response.message);
      },
      error: (error) => {
        this.toaster.error(error.message);
      },
    });
  }

  // ==================== NAVIGATION & CLEANUP ====================
  backWithoutFinishing() {
    if (this.isInterviewActive && !confirm('Leave interview without saving?')) return;

    this.isListening = false;
    this.isInterviewActive = false;
    this.stopTimer();
    this.stopRealtimeAudioCapture();
    this.ws?.close();
    this.stopHeartbeat();

    // Optional: still deduct partial time if user abandons
    const secondsInCurrentMinute = this.elapsedTime % 60;
    if (secondsInCurrentMinute > 0) {
      const partialMinutes = secondsInCurrentMinute / 60;
      this.deductPartialTime(partialMinutes);
    }

    this.cleanupInterviewState();
  }

  ngOnDestroy() {
    this.backWithoutFinishing();
  }

  backToDashboard() {
    if (this.isInterviewActive && !confirm('Leave interview?')) return;
    this.backWithoutFinishing();
    this.router.navigate(['dashboard']);
  }

  getUserTier() {
    this.authService.getUser().subscribe({
      next: (response) => {
        if (response) {
          this.userTier = response.user.tier;
          this.remainingMinutes = response.user.remainingMinutes || 0;
        }
      },
      error: (error) => {
        this.toaster.error(error.message);
      },
    });
  }
}
