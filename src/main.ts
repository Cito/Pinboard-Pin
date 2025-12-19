import { enableProdMode, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { AppComponent } from './app/app.component';
import { LoginComponent } from './app/login/login.component';
import { PinPageComponent } from './app/pinpage/pinpage.component';
import { OptionsComponent } from './app/options/options.component';
import { BackgroundComponent } from './app/background/background.component';
import { guard } from './app/guard';
import { PinboardService } from './app/pinboard.service';
import { StorageService } from './app/storage.service';
import { IconService } from './app/icon.service';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

const appRoutes = [
  { path: 'login', component: LoginComponent },
  { path: 'options', component: OptionsComponent },
  { path: 'background', component: BackgroundComponent },
  { path: '**', component: PinPageComponent, canActivate: [guard] }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    PinboardService,
    StorageService,
    IconService
  ]
}).catch(error => console.error(error));
