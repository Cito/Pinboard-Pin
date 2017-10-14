import { Injectable } from '@angular/core';
import {
  Router, ActivatedRouteSnapshot,
  RouterStateSnapshot, CanActivate
} from '@angular/router';

import {Observable} from 'rxjs/Observable';

import {PinboardService} from './pinboard.service';

// Guard for the index route of this extension

@Injectable()
export class Guard implements CanActivate {

  constructor(private pinboard: PinboardService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot,
              state: RouterStateSnapshot): Observable<boolean>|boolean {

    const page = route.queryParams['page'];

    if (!page || page === 'popup') {
      return this.pinboard.needToken.map(needed => {
        if (!needed) {
          return true;
        }
        this.router.navigate(['/login']);
        return false;
      });
    }

    this.router.navigate(['/' + page]);
    return false;
  }

}
