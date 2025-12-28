import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  imports: [CommonModule, FormsModule],
})
export class HeaderComponent {
  protectionEnabled = true;

  constructor(private router:Router) {
    
  }

  async onToggle() {
    if (window.electronAPI) {
      const state = await window.electronAPI.toggleProtection(this.protectionEnabled);
      console.log('Screen protection is now:', state ? 'ON' : 'OFF');
    } else {
      console.warn('⚠️ Not running in Electron.');
    }
  }

  onLogoClick(){
this.router.navigate(['dashboard'])
  }
}
