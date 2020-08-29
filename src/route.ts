import * as H from 'history';
import * as qs from 'query-string';

export function navigate(history: H.History, stateTo: string) {
  history.push(stateTo);
}

export function buildFromUrl(): any {
  return buildParameters(window.location.search);
}
export function buildParameters(url: string): any {
  let urlSearch = url;
  const i = urlSearch.indexOf('?');
  if (i >= 0) {
    urlSearch = url.substr(i + 1);
  }
  const parsed = qs.parse(urlSearch);
  return parsed;
}
