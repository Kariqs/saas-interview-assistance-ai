import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface User {
  id: number;
  name: string;
  email: string;
  joinedDate: Date;
  interviewsCount: number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class UsersComponent implements OnInit {
generateAccessCode(_t33: User) {
throw new Error('Method not implemented.');
}
  // Full list of users
  users: User[] = [];
  filteredUsers: User[] = [];

  // UI state
  searchTerm: string = '';
  totalUsers: number = 0;
  currentPage: number = 1;
  pageSize: number = 10;

  ngOnInit(): void {
    this.generateDummyData();
    this.totalUsers = this.users.length;
    this.applyFiltersAndPagination();
  }

  // Generate realistic dummy users
  private generateDummyData(): void {
    const firstNames = [
      'Alex',
      'Jordan',
      'Taylor',
      'Morgan',
      'Casey',
      'Riley',
      'Jamie',
      'Quinn',
      'Avery',
      'Cameron',
    ];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Martinez',
      'Wilson',
    ];
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'protonmail.com', 'icloud.com'];

    this.users = Array.from({ length: 57 }, (_, i) => {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)];
      const last = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${first} ${last}`;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@${
        domains[Math.floor(Math.random() * domains.length)]
      }`;
      const joinedDate = new Date(
        2024,
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1
      );
      const interviewsCount = Math.floor(Math.random() * 35); // 0 to 34 interviews

      return {
        id: i + 1,
        name,
        email,
        joinedDate,
        interviewsCount,
      };
    });

    // Sort by joined date descending (newest first)
    this.users.sort((a, b) => b.joinedDate.getTime() - a.joinedDate.getTime());
  }

  // Filter by search term and apply pagination
  private applyFiltersAndPagination(): void {
    let temp = [...this.users];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      temp = temp.filter(
        (user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      );
    }

    this.totalUsers = temp.length;

    // Apply pagination
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.filteredUsers = temp.slice(start, end);
  }

  // Called on search input change
  filterUsers(): void {
    this.currentPage = 1; // Reset to first page on new search
    this.applyFiltersAndPagination();
  }

  // Pagination controls
  nextPage(): void {
    if (this.currentPage * this.pageSize < this.totalUsers) {
      this.currentPage++;
      this.applyFiltersAndPagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFiltersAndPagination();
    }
  }

  // Action handlers (you can expand these later)
  viewUserDetails(user: User): void {
    alert(
      `View details for: ${user.name}\nEmail: ${user.email}\nInterviews: ${user.interviewsCount}`
    );
    // Later: open modal or navigate to user detail page
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
      this.users = this.users.filter((u) => u.id !== user.id);
      this.totalUsers = this.users.length;
      this.applyFiltersAndPagination();
      // Later: call API to delete from backend
    }
  }

  // Optional: admin logout
  logout(): void {
    alert('Logged out (implement auth service redirection)');
    // Later: this.authService.logout(); this.router.navigate(['/login']);
  }
}
