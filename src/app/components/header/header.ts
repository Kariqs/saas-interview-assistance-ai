import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  imports: [CommonModule, FormsModule],
})
export class HeaderComponent {
  protectionEnabled = true;

  async onToggle() {
    if (window.electronAPI) {
      const state = await window.electronAPI.toggleProtection(this.protectionEnabled);
      console.log('Screen protection is now:', state ? 'ON' : 'OFF');
    } else {
      console.warn('⚠️ Not running in Electron.');
    }
  }
}
