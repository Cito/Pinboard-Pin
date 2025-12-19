import { Component } from '@angular/core';


// Root component of the application

@Component({
    selector: 'app-root',
    template: '<router-outlet></router-outlet>',
    standalone: false
})
export class AppComponent { }
