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
  isListening = false;
  elapsedTime = 0;
  notes = '';
  questions: Question[] = [];
  typedQuestion = '';
  isProcessing = false;
  resumeFile: File | null = null;
  resumeUploaded = false;
  resumeText = '';

  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private intervalId: any;
  private audioChunks: Blob[] = [];

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

      if (!response.ok) {
        throw new Error('Failed to upload resume');
      }

      const data = await response.json();
      this.resumeText = data.text;
      this.resumeUploaded = true;
      console.log('✅ Resume uploaded successfully');
    } catch (error: any) {
      console.error('❌ Failed to upload resume:', error);
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
      this.isListening = true;
      this.startTimer();

      // Connect to WebSocket
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.onopen = () => {
        console.log('✅ Connected to server');
        // Send resume context to server
        this.ws?.send(
          JSON.stringify({
            type: 'set-context',
            resumeText: this.resumeText,
          })
        );
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        alert('Failed to connect to server. Make sure the backend is running.');
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from server');
      };

      // Start audio recording
      await this.startAudioRecording();
    } catch (error) {
      console.error('Failed to start interview:', error);
      alert('Failed to start interview. Please check microphone permissions.');
      this.isListening = false;
    }
  }

  async startAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.sendAudioChunk(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('🎙️ Recording stopped, transcribing...');
        this.transcribeAudio();
      };

      this.mediaRecorder.start(1000);
      console.log('🎙️ Recording started');
    } catch (error) {
      console.error('Failed to access microphone:', error);
      throw error;
    }
  }

  sendAudioChunk(chunk: Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Audio = (reader.result as string).split(',')[1];
      this.ws?.send(
        JSON.stringify({
          type: 'audio-chunk',
          audio: base64Audio,
        })
      );
    };
    reader.readAsDataURL(chunk);
  }

  stopAndTranscribe() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.isProcessing = true;
      this.mediaRecorder.stop();
    }
  }

  transcribeAudio() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected');
      this.isProcessing = false;
      return;
    }

    if (this.audioChunks.length === 0) {
      console.warn('⚠️ No audio chunks to transcribe');
      this.isProcessing = false;
      return;
    }

    console.log(`📤 Sending transcribe request (${this.audioChunks.length} chunks)`);
    this.ws.send(JSON.stringify({ type: 'transcribe' }));
  }

  async submitTypedQuestion() {
    const question = this.typedQuestion.trim();

    if (!question) {
      return;
    }

    if (!this.resumeUploaded) {
      alert('Please upload your resume first');
      return;
    }

    this.isProcessing = true;
    console.log('⌨️ Submitting typed question:', question);

    try {
      const response = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          resumeText: this.resumeText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();
      this.addQuestion(question, data.answer);
      this.typedQuestion = '';
    } catch (error: any) {
      console.error('❌ Failed to get answer:', error);
      alert(`Failed to get answer: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  handleServerMessage(data: any) {
    console.log('📨 Server message:', data);

    switch (data.type) {
      case 'chunk-received':
        break;

      case 'info':
        console.log('ℹ️', data.message);
        break;

      case 'transcription':
        console.log('📝 Transcription:', data.text);
        break;

      case 'qa-response':
        console.log('💬 Q&A Response received');
        this.addQuestion(data.question, data.answer);
        this.isProcessing = false;

        this.audioChunks = [];

        setTimeout(async () => {
          if (this.isListening) {
            console.log('🔄 Restarting recording...');

            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
              this.mediaRecorder.stop();
            }

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'clear' }));
            }

            await this.startAudioRecording();
          }
        }, 500);
        break;

      case 'cleared':
        console.log('🧹 Server buffer cleared');
        break;

      case 'context-set':
        console.log('📄 Resume context set on server');
        break;

      case 'error':
        console.error('❌ Server error:', data.message);
        alert(`Error: ${data.message}`);
        this.isProcessing = false;
        break;
    }
  }

  endInterview() {
    this.isListening = false;
    this.stopTimer();

    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      this.mediaRecorder = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.questions = [];
    this.elapsedTime = 0;
    this.audioChunks = [];
    this.typedQuestion = '';
    this.isProcessing = false;

    console.log('🛑 Interview ended');
  }

  addQuestion(question: string, answer: string) {
    this.questions.push({
      id: this.questions.length + 1,
      question,
      answer,
    });
    console.log(`✅ Added question ${this.questions.length}`);
  }

  startTimer() {
    this.intervalId = setInterval(() => {
      this.elapsedTime++;
    }, 1000);
  }

  stopTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.endInterview();
  }

  backToDashboard() {
    if (this.isListening) {
      if (confirm('Interview is in progress. Are you sure you want to leave?')) {
        this.endInterview();
        this.router.navigate(['dashboard']);
      }
    } else {
      this.router.navigate(['dashboard']);
    }
  }
}
