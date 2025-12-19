import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Routes, RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { PinPageComponent } from './pinpage/pinpage.component';
import { OptionsComponent } from './options/options.component';
import { BackgroundComponent } from './background/background.component';

import { guard } from './guard';
import { PinboardService } from './pinboard.service';
import { StorageService } from './storage.service';
import { IconService } from './icon.service';

import { AgoPipe } from './interval.pipe';


const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'options', component: OptionsComponent },
  { path: 'background', component: BackgroundComponent },
  { path: '**', component: PinPageComponent, canActivate: [guard] }
];


@NgModule({ declarations: [
        AppComponent,
        PinPageComponent,
        OptionsComponent,
        LoginComponent,
        AgoPipe,
        BackgroundComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        FormsModule,
        RouterModule.forRoot(appRoutes)], providers: [PinboardService, StorageService, IconService, provideHttpClient(withInterceptorsFromDi())] })
export class AppModule { }
