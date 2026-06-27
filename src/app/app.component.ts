import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';


// Root component of the application

@Component({
    selector: 'app-root',
    template: '<router-outlet></router-outlet>',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterOutlet]
})
export class AppComponent { }
