import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
export class Interview {
  constructor(private router: Router) {}

  isListening = false;
  autoMode = false;
  elapsedTime = 0;
  notes = '';
  questions: Question[] = [];
  private intervalId: any;

  startInterview() {
    this.isListening = true;
    this.startTimer();

    // Simulate receiving questions after a delay
    setTimeout(() => {
      this.addQuestion(
        'Tell me about yourself',
        "I'm a software engineer with 5 years of experience in full-stack development. I've worked extensively with React, Node.js, and cloud technologies. In my current role, I've led the development of several key features that improved user engagement by 40%."
      );
    }, 2000);

    setTimeout(() => {
      this.addQuestion(
        'What are your strengths?',
        'My key strengths include problem-solving, adaptability, and strong communication skills. I excel at breaking down complex problems into manageable components and collaborating with cross-functional teams to deliver solutions.'
      );
    }, 5000);

    setTimeout(() => {
      this.addQuestion(
        'Why do you want to work here?',
        "I'm impressed by your company's commitment to innovation and the impact your products have on users. The role aligns perfectly with my experience in scalable systems, and I'm excited about the opportunity to contribute to your engineering culture."
      );
    }, 8000);
  }

  endInterview() {
    this.isListening = false;
    this.stopTimer();
    this.questions = [];
    this.elapsedTime = 0;
    this.router.navigate(['interview']);
  }

  addQuestion(question: string, answer: string) {
    this.questions.push({
      id: this.questions.length + 1,
      question,
      answer,
    });
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
    this.stopTimer();
  }

  backToDashboard() {
    this.router.navigate(['dashboard']);
  }
}
