import {Pipe, PipeTransform} from '@angular/core';

const msPerSecond = 1000;
const msPerMinute = msPerSecond * 60;
const msPerHour = msPerMinute * 60;
const msPerDay = msPerHour * 24;
const msPerMonth = msPerDay * 30;
const msPerYear = msPerDay * 365;

const intervalUnits = [
  'second', 'minute', 'hour', 'day', 'month', 'year'];
const intervalParts = [
  msPerSecond, msPerMinute, msPerHour, msPerDay, msPerMonth, msPerYear];


// Pipe for showing time intervals

@Pipe({
  name: 'ago'
})
export class AgoPipe implements PipeTransform {

  // show date as passed time in simple human readable form
  transform(value: Date|string): string {
    if (!value) {
      return 'some time ago';
    }

    const time: number = typeof value === 'string' ?
      Date.parse(value as string) : (value as Date).getTime();
    const elapsed = Date.now() - time;

    if (elapsed < 0) {
      return 'some time ago';
    }
    if (elapsed < msPerSecond) {
      return 'just now';
    }

    for (let i = 0; i < 6; ++i) {
      if (i > 4 || elapsed < intervalParts[i + 1]) {
        const n = Math.round(elapsed / intervalParts[i]);
        let unit = intervalUnits[i];
        if (n !== 1) {
          unit += 's';
        }
        return n + ' ' + unit + ' ago';
      }
    }
  }

}
