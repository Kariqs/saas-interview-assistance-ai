import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GotchYou } from './gotch-you';

describe('GotchYou', () => {
  let component: GotchYou;
  let fixture: ComponentFixture<GotchYou>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GotchYou]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GotchYou);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
