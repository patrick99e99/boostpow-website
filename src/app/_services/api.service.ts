import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class APIService {

  private boostSubject: BehaviorSubject<any>;
  public boosts: Observable<any>;

  private searchSubject: BehaviorSubject<any>;
  public search: Observable<any>;

  constructor(private http: HttpClient) {
    this.boostSubject = new BehaviorSubject<any>([]);
    this.boosts = this.boostSubject.asObservable();
    this.searchSubject = new BehaviorSubject<any>([]);
    this.search = this.searchSubject.asObservable();
    // this.searchBoost("B", 86400*14);
  }

  async searchBoost(q?:string, t?:number) {
    this.searchSubject.next({ category: q, timeframe: t});
    //Set API URL
    let searchUrl = `${environment.apiUrl}/search`;

    //Create query params
    let query:string[] = [];
    if(!!q){
      query.push("categoryutf8=" + q)
    }
    if(!!t && t>0) {
      const t2 = Math.floor(new Date().getTime()/1000) - t;
      query.push("minedTimeFrom=" + t2);
    }
    if(query.length){
      searchUrl+="?"+query.join("&");
    }

    //Execute search
    const results: any = await this.http.get(searchUrl).toPromise();

    //Group results by unique boost content
    let finalResults = Object(null);
    results.mined.forEach(r => {
      if(finalResults[r.boostData.content]){
        finalResults[r.boostData.content].value += r.boostJob.value;
        finalResults[r.boostData.content].diff += r.boostJob.diff;
        finalResults[r.boostData.content].jobs.push(r.boostJob);
      } else {
        Object.assign(finalResults, { [r.boostData.content]: { ...r.boostData, jobs: [r.boostJob], diff: r.boostJob.diff, value: r.boostJob.value } });
      }
    });
    //Convert to array and order by PoW
    finalResults = Object.keys(finalResults).map(k => { return { content: k, ...finalResults[k], diff: Math.round(finalResults[k].diff) } }).sort((a,b) => {return b.diff - a.diff}).map((x, i) => {
      return {...x, rank: i+1};
    });
    //Assign to behaviour subject to make cascading changes
    this.boostSubject.next(finalResults);
  }

  public get boostsValue(): any {
    return this.boostSubject.value;
  }

  async getFileType(id: string) {
    const r = await this.http.head(` https://media.bitcoinfiles.org/${id}`, {observe: 'response'}).toPromise();
    return r.headers.get('content-type')?.replace("; charset=utf-8", "") || 'unknown';
  }

  async getOne(id: string){
    // const one = this.boosts.value.find(x => { return x.content === id})
    const results: any = await this.http.get(`${environment.apiUrl}/search?contenthex=${id}`).toPromise();
    let finalResults = {
      content: id,
      ...results.mined[0].boostData,
      value: 0,
      diff: 0,
      rank: 0,
      categories: [],
      jobs: []
    };
    results.mined.forEach(r => {
      finalResults.value += r.boostJob.value;
      finalResults.diff += r.boostJob.diff;
      finalResults.jobs.push(r.boostJob);
      if(r.boostData.categoryutf8 && finalResults.categories.indexOf(r.boostData.categoryutf8)<0){
        finalResults.categories.push(r.boostData.categoryutf8);
      }
    });
    finalResults.diff = Math.round(finalResults.diff);
    console.log(finalResults);
    return finalResults;
  }
}
