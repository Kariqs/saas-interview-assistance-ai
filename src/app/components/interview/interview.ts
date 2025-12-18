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
  questions: Question[] = [];
  currentTranscription = '';
  isProcessing = false;
  isGeneratingAnswer = false;
  resumeFile: File | null = null;
  resumeUploaded = false;
  resumeText = '';
  private ws: WebSocket | null = null;

  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  private intervalId: any;

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
      const response = await fetch('http://localhost:3000/upload-resume', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload resume');
      const data = await response.json();
      this.resumeText = data.text;
      this.resumeUploaded = true;
    } catch (error: any) {
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

    this.isInterviewActive = true;
    this.startTimer();

    this.ws = new WebSocket('ws://localhost:3000');

    this.ws.onopen = () => {
      console.log('WebSocket connected for transcription');
    };

    this.ws.onmessage = (e) => this.handleServerMessage(JSON.parse(e.data));

    this.ws.onerror = () => alert('WebSocket connection failed');

    this.ws.onclose = () => console.log('WebSocket closed');

    this.startListening();
  }

  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.startRealtimeAudioCapture();
  }

  stopListening() {
    this.isListening = false;
    this.stopRealtimeAudioCapture();
  }

  async answerWithAI() {
    const transcription = this.currentTranscription.trim();
    if (!transcription) {
      alert('No question transcribed yet');
      return;
    }
    if (this.isGeneratingAnswer) return;

    console.log('Sending question to backend:', transcription);

    this.isGeneratingAnswer = true;
    this.stopListening();

    try {
      const response = await fetch('http://localhost:3000/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: transcription,
          resumeText: this.resumeText,
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

  async startRealtimeAudioCapture() {
    try {
      let stream: MediaStream;

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

  addQuestion(question: string, answer: string) {
    this.questions.push({
      id: this.questions.length + 1,
      question: question.trim(),
      answer: answer.trim(),
    });
  }

  endInterview() {
    this.isListening = false;
    this.isInterviewActive = false;
    this.stopTimer();
    this.stopRealtimeAudioCapture();
    this.ws?.close();
    this.ws = null;
    this.questions = [];
    this.currentTranscription = '';
    this.elapsedTime = 0;
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
