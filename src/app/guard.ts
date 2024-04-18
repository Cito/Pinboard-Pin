import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';

import { map } from 'rxjs/operators';

import { PinboardService } from './pinboard.service';


// Guard for the index route of this extension


export const guard = (route: ActivatedRouteSnapshot) => {
  const pinboard = inject(PinboardService);
  const router = inject(Router);
  
  const page = route.queryParams['page'];

  if (!page || page === 'popup') {
    return pinboard.needToken.pipe(map(needed => {
      if (!needed) {
        return true;
      }
      router.navigate(['/login']);
      return false;
    }));
  }

  router.navigate(['/' + page]);
  return false;
};
