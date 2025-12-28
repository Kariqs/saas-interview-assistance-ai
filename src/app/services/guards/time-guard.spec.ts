import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { timeGuard } from './time-guard';

describe('timeGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => timeGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
