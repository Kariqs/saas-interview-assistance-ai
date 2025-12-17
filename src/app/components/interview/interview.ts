import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
})
export class Interview implements OnDestroy {
  isInterviewActive = false;
  isListening = false;
  elapsedTime = 0;
  notes = '';
  questions: Question[] = [];
  currentTranscription = '';
  isProcessing = false;
  isGeneratingAnswer = false;
  resumeFile: File | null = null;
  resumeUploaded = false;
  resumeText = '';
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private intervalId: any;
  private audioChunks: Blob[] = [];
  private currentMimeType = 'audio/webm;codecs=opus'; // Default fallback

  // State machine to prevent race conditions
  private transcriptionState:
    | 'idle'
    | 'paused-for-transcribe'
    | 'awaiting-transcription'
    | 'awaiting-answer' = 'idle';

  constructor(private router: Router) {}

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
      const response = await fetch('http://localhost:3000/api/upload-resume', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload resume');
      const data = await response.json();
      this.resumeText = data.text;
      this.resumeUploaded = true;
      console.log('Resume uploaded successfully');
    } catch (error: any) {
      console.error('Resume upload failed:', error);
      alert(`Failed to upload resume: ${error.message}`);
      this.resumeFile = null;
    } finally {
      this.isProcessing = false;
    }
  }

  async startInterview() {
    if (!this.resumeUploaded) {
      alert('Please upload your resume first');
      return;
    }
    try {
      this.isInterviewActive = true;
      this.startTimer();
      // Connect WebSocket
      this.ws = new WebSocket('ws://localhost:3000');
      this.ws.onopen = () => {
        console.log('Connected to server');
        this.ws?.send(JSON.stringify({ type: 'set-context', resumeText: this.resumeText }));
      };
      this.ws.onmessage = (e) => this.handleServerMessage(JSON.parse(e.data));
      this.ws.onerror = () => alert('Server connection failed. Is backend running?');
      this.ws.onclose = () => console.log('Disconnected from server');
      this.startListening();
    } catch (error) {
      console.error('Failed to start interview:', error);
      alert('Audio permission denied or capture failed.');
      this.isInterviewActive = false;
    }
  }

  startListening() {
    if (this.transcriptionState !== 'idle') {
      this.transcriptionState = 'idle';
      this.currentTranscription = '';
    }
    this.isListening = true;
    this.audioChunks = [];
    this.startSystemAudioRecording();
  }

  pauseAndTranscribe() {
    this.isListening = false;
    this.stopRecorder();
    console.log('Recorder stopped for pause');
    this.transcribeCurrentAudio();
  }

  async transcribeCurrentAudio() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.transcriptionState !== 'idle') return;
    if (this.audioChunks.length < 1) {
      console.log('Not enough audio, skipping...');
      return;
    }
    this.transcriptionState = 'paused-for-transcribe';
    this.isProcessing = true;
    console.log(
      `Requesting transcription (${this.audioChunks.length} chunks, ${this.currentMimeType})...`
    );
    this.ws.send(JSON.stringify({ type: 'transcribe-only' }));
  }

  async answerWithAI() {
    if (!this.currentTranscription.trim()) {
      alert('No transcription to answer');
      return;
    }
    if (this.transcriptionState !== 'awaiting-transcription') {
      console.log('Transcription not ready for AI');
      return;
    }
    this.transcriptionState = 'awaiting-answer';
    this.isGeneratingAnswer = true;
    this.ws?.send(
      JSON.stringify({
        type: 'generate-answer',
        transcription: this.currentTranscription,
      })
    );
  }

  async startSystemAudioRecording() {
    try {
      let stream: MediaStream;
      if (window.electronAPI?.getAudioSources) {
        console.log('Running in Electron - capturing system audio');
        if (window.electronAPI.requestAudioPermission) {
          const granted = await window.electronAPI.requestAudioPermission();
          if (!granted) throw new Error('Audio permission denied');
        }
        const sources = await window.electronAPI.getAudioSources();
        if (sources.length === 0) throw new Error('No audio sources');
        const audioSource = sources[0];
        console.log('Selected audio source:', audioSource.name);
        stream = await (navigator.mediaDevices as any).getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: audioSource.id,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
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
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          const loopback = await (navigator.mediaDevices as any).getUserMedia({
            audio: {
              mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: audioSource.id },
            },
          });
          const tracks = loopback.getAudioTracks();
          stream = tracks.length > 0 ? new MediaStream(tracks) : stream;
        } else {
          stream = new MediaStream(audioTracks);
        }
        stream.getVideoTracks().forEach((t) => t.stop());
      } else {
        console.warn('Using microphone (non-Electron)');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
        });
      }
      if (stream.getAudioTracks().length === 0) throw new Error('No audio track');

      // === MIME TYPE SELECTION (CRITICAL FIX) ===
      let mimeType = 'audio/webm;codecs=opus'; // fallback

      if (MediaRecorder.isTypeSupported('audio/mp3')) {
        mimeType = 'audio/mp3';
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      this.currentMimeType = mimeType;
      console.log('Selected recording format:', mimeType);

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
          this.sendAudioChunk(e.data);
        }
      };
      this.mediaRecorder.start(1000); // 1-second chunks
      console.log('Recording started');
    } catch (error: any) {
      console.error('Audio capture error:', error);
      alert(`Audio failed: ${error.message}`);
      throw error;
    }
  }

  sendAudioChunk(chunk: Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      this.ws?.send(
        JSON.stringify({
          type: 'audio-chunk',
          audio: base64,
          mimeType: this.currentMimeType, // ← NEW: Send mime type
        })
      );
    };
    reader.readAsDataURL(chunk);
  }

  handleServerMessage(data: any) {
    console.log('Server message:', data);
    switch (data.type) {
      case 'chunk-received':
        // Optional: add visual feedback if desired
        break;
      case 'info':
        console.log('Info:', data.message);
        break;
      case 'transcription':
        console.log('Transcription:', data.text);
        this.currentTranscription = data.text;
        this.audioChunks = [];
        this.isProcessing = false;
        if (this.transcriptionState === 'paused-for-transcribe') {
          this.transcriptionState = 'awaiting-transcription';
        }
        break;
      case 'qa-response':
        console.log('AI answer received');
        this.addQuestion(data.question, data.answer);
        this.currentTranscription = '';
        this.audioChunks = [];
        this.isGeneratingAnswer = false;
        this.transcriptionState = 'idle';
        break;
      case 'context-set':
        console.log('Resume context set');
        break;
      case 'error':
        console.error('Server error:', data.message);
        this.audioChunks = [];
        this.isProcessing = false;
        this.isGeneratingAnswer = false;
        this.transcriptionState = 'idle';
        const suppressed = ['Transcoding', 'Gemini', 'timeout', 'ENOTFOUND'];
        if (!suppressed.some((e) => data.message.includes(e))) {
          alert(`Error: ${data.message}`);
        } else {
          console.log('Recoverable error, continuing...');
        }
        break;
    }
  }

  private stopRecorder() {
    if (!this.mediaRecorder) return;
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder.ondataavailable = null;
    this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    this.mediaRecorder = null;
    console.log('Recorder stopped');
  }

  endInterview() {
    this.isListening = false;
    this.isInterviewActive = false;
    this.stopTimer();
    this.stopRecorder();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.questions = [];
    this.elapsedTime = 0;
    this.audioChunks = [];
    this.currentTranscription = '';
    this.isProcessing = false;
    this.isGeneratingAnswer = false;
    this.transcriptionState = 'idle';
    console.log('Interview ended');
  }

  addQuestion(question: string, answer: string) {
    this.questions.push({ id: this.questions.length + 1, question, answer });
  }

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

  ngOnDestroy() {
    this.endInterview();
  }

  backToDashboard() {
    if (this.isInterviewActive && !confirm('Leave interview?')) return;
    this.endInterview();
    this.router.navigate(['dashboard']);
  }
}
