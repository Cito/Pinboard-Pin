import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpModule} from '@angular/http';
import {Routes, RouterModule} from "@angular/router";

import {AppComponent} from './app.component';
import {LoginComponent} from './login/login.component';
import {PinPageComponent} from './pinpage/pinpage.component';
import {OptionsComponent} from './options/options.component';
import {BackgroundComponent} from './background/background.component';

import {Guard} from "./guard.service";
import {PinboardService} from "./pinboard.service";
import {StorageService} from "./storage.service";
import {IconService} from "./icon.service";

import {AgoPipe} from './interval.pipe';


const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'options', component: OptionsComponent },
  { path: 'background', component: BackgroundComponent },
  { path: '**', component: PinPageComponent, canActivate: [Guard] }
];


@NgModule({
  declarations: [
    AppComponent,
    PinPageComponent,
    OptionsComponent,
    LoginComponent,
    AgoPipe,
    BackgroundComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    RouterModule.forRoot(appRoutes)
  ],
  providers: [Guard, PinboardService, StorageService, IconService],
  bootstrap: [AppComponent]
})
export class AppModule {}
