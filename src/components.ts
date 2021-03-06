import * as React from 'react';
import {clone, makeDiff} from 'reflectx';
import {addParametersIntoUrl, append, buildSearchMessage, changePage, changePageSize, formatResultsByComponent, getDisplayFieldsFromForm, getModel, handleSortEvent, initSearchable, mergeSearchModel as mergeSearchModel2, more, reset, Searchable, showResults as showResults2, validate} from 'search-utilities';
import {buildId, EditStatusConfig, error, getCurrencyCode, getModelName as getModelName2, HistoryProps, initForm, LoadingService, Locale, message, messageByHttpStatus, Metadata, ModelHistoryProps, ModelProps, removePhoneFormat, ResourceService, SearchModel, SearchParameter, SearchResult, SearchService, SearchState, StringMap, UIService, ViewParameter, ViewService} from './core';
import {build, createModel as createModel2, EditParameter, GenericService, handleStatus, handleVersion, initPropertyNullInModel, ResultInfo} from './edit';
import {focusFirstError, readOnly} from './formutil';
import {getAutoSearch, getConfirmFunc, getEditStatusFunc, getErrorFunc, getLoadingFunc, getLocaleFunc, getMsgFunc, getResource, getUIService} from './input';
import {buildFromUrl} from './route';
import {buildFlatState, buildState, handleEvent, handleProps, localeOf} from './state';

export const scrollToFocus = (e: any, isUseTimeOut?: boolean) => {
  try {
    const element = e.target as HTMLInputElement;
    const container = element.form.childNodes[1] as HTMLElement;
    const elementRect = element.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + window.pageYOffset;
    const middle = absoluteElementTop - (window.innerHeight / 2);
    const scrollTop = container.scrollTop;
    const timeOut = isUseTimeOut ? 300 : 0;
    const isChrome = navigator.userAgent.search('Chrome') > 0;
    setTimeout(() => {
      if (isChrome) {
        const scrollPosition = scrollTop === 0 ? (elementRect.top + 64) : (scrollTop + middle);
        container.scrollTo(0, Math.abs(scrollPosition));
      } else {
        container.scrollTo(0, Math.abs(scrollTop + middle));
      }
    }, timeOut);
  } catch (e) {
    console.log(e);
  }
};
export class ViewComponent<T, ID, P extends HistoryProps, S> extends React.Component<P, S> {
  constructor(props: P, sv: ((id: ID, ctx?: any) => Promise<T>)|ViewService<T, ID>,
      param: ResourceService|ViewParameter,
      showError?: (msg: string, title?: string, detail?: string, callback?: () => void) => void,
      getLocale?: (profile?: string) => Locale,
      loading?: LoadingService) {
    super(props, getLocaleFunc(param, getLocale));
    this.resourceService = getResource(param);
    this.resource = this.resourceService.resource();
    this.showError = getErrorFunc(param, showError);
    this.loading = getLoadingFunc(param, loading);
    if (sv) {
      if (typeof sv === 'function') {
        this.loadData = sv;
      } else {
        this.service = sv;
        if (this.service.metadata) {
          const m = this.service.metadata();
          if (m) {
            this.metadata = m;
            const meta = build(m);
            this.keys = meta.keys;
          }
        }
      }
    }
    this.back = this.back.bind(this);
    this.getModelName = this.getModelName.bind(this);
    this.load = this.load.bind(this);
    this.getModel = this.getModel.bind(this);
    this.showModel = this.showModel.bind(this);
    this.ref = React.createRef();
  }
  protected running: boolean;
  protected resourceService: ResourceService;
  protected resource: StringMap;
  protected loading?: LoadingService;
  protected showError: (msg: string, title?: string, detail?: string, callback?: () => void) => void;
  protected loadData: (id: ID, ctx?: any) => Promise<T>;
  protected service: ViewService<T, ID>;
  protected form: HTMLFormElement;
  protected ref: any;
  protected keys?: string[];
  protected metadata?: Metadata;

  protected back(event: any) {
    if (event) {
      event.preventDefault();
    }
    this.props.history.goBack();
  }
  protected getModelName(): string {
    if (this.metadata) {
      return this.metadata.name;
    }
    const n = getModelName2(this.form);
    if (!n || n.length === 0) {
      return 'model';
    }
  }
  componentDidMount() {
    this.form = this.ref.current;
    const id = buildId<ID>(this.props, this.keys);
    this.load(id);
  }
  async load(_id: ID, callback?: (m: T, showF: (model: T) => void) => void) {
    const id: any = _id;
    if (id != null && id !== '') {
      this.running = true;
      if (this.loading) {
        this.loading.showLoading();
      }
      try {
        const ctx: any = {};
        let obj: T;
        if (this.loadData) {
          obj = await this.loadData(id, ctx);
        } else {
          obj = await this.service.load(id, ctx);
        }
        if (!obj) {
          this.handleNotFound(this.form);
        } else {
          if (callback) {
            callback(obj, this.showModel);
          } else {
            this.showModel(obj);
          }
        }
      } catch (err) {
        const data = (err &&  err.response) ? err.response : err;
        if (data && data.status === 404) {
          this.handleNotFound(this.form);
        } else {
          error(err, this.resourceService.value, this.showError);
        }
      } finally {
        this.running = false;
        if (this.loading) {
          this.loading.hideLoading();
        }
      }
    }
  }
  protected handleNotFound(form?: HTMLFormElement): void {
    const msg = message(this.resourceService.value, 'error_not_found', 'error');
    if (form) {
      readOnly(form);
    }
    this.showError(msg.message, msg.title);
  }
  getModel(): T {
    return this.state[this.getModelName()];
  }
  showModel(model: T) {
    const modelName = this.getModelName();
    const objSet: any = {};
    objSet[modelName] = model;
    this.setState(objSet);
  }
}

export class BaseComponent<P extends ModelProps, S> extends React.Component<P, S> {
  constructor(props: P,
      protected getLocale?: () => Locale,
      private removeErr?: (ctrl: HTMLInputElement) => void) {
    super(props);
    this.getModelName = this.getModelName.bind(this);
    this.updateState = this.updateState.bind(this);
    this.updateFlatState = this.updateFlatState.bind(this);
    this.updatePhoneState = this.updatePhoneState.bind(this);
    this.updateDateState = this.updateDateState.bind(this);
    this.prepareCustomData = this.prepareCustomData.bind(this);
  }
  protected running: boolean;
  protected form: HTMLFormElement;
  /*
  protected handleSubmitForm(e) {
    if (e.which === 13) {
      if (document.getElementById('sysAlert').style.display !== 'none') {
        document.getElementById('sysYes').click();
      } else {
        document.getElementById('btnSave').click();
      }
    } else if (e.which === 27) {
      document.getElementById('sysNo').click();
    }
  }
*/

  prepareCustomData(data: any) { }

  protected updatePhoneState = (event: any) => {
    const re = /^[0-9\b]+$/;
    const target = event.currentTarget as HTMLInputElement;
    const value = removePhoneFormat(target.value);
    if (re.test(value) || !value) {
      this.updateState(event);
    } else {
      const splitArr = value.split('');
      let responseStr = '';
      splitArr.forEach(element => {
        if (re.test(element)) {
          responseStr += element;
        }
      });
      target.value = responseStr;
      this.updateState(event);
    }
  }

  protected updateDateState = (name: string, value: any) => {
    const props: any = this.props;
    const modelName = this.getModelName(this.form);
    const state = this.state[modelName];
    if (props.setGlobalState) {
      const data = props.shouldBeCustomized ? this.prepareCustomData({ [name]: value }) : { [name]: value };
      props.setGlobalState({ [modelName]: { ...state, ...data } });
    } else {
      const objSet: any = {[modelName]: {...state, [name]: value}};
      this.setState(objSet);
    }
  }
  protected getModelName(f?: HTMLFormElement): string {
    let f2 = f;
    if (!f2) {
      f2 = this.form;
    }
    if (f2) {
      const a = getModelName2(f2);
      if (a && a.length > 0) {
        return a;
      }
    }
    return 'model';
  }
  protected updateState = (e: any, callback?: () => void, lc?: Locale) => {
    const ctrl = e.currentTarget as HTMLInputElement;
    const modelName = this.getModelName(ctrl.form);
    const l = localeOf(lc, this.getLocale);
    const props = this.props;
    handleEvent(e, this.removeErr);
    if (props.setGlobalState) {
      handleProps(e, props, ctrl, modelName, l, this.prepareCustomData);
    } else {
      const objSet: any = buildState(e, this.state, ctrl, modelName, l);
      if (objSet) {
        if (callback) {
          this.setState(objSet, callback);
        } else {
          this.setState(objSet);
        }
      }
    }
  }
  protected updateFlatState(e: any, callback?: () => void, lc?: Locale) {
    const l = localeOf(lc, this.getLocale);
    const objSet: any = buildFlatState(e, this.state, l);
    if (objSet != null) {
      if (callback) {
        this.setState(objSet, callback);
      } else {
        this.setState(objSet);
      }
    }
  }
}
export class BaseSearchComponent<T, S extends SearchModel, P extends ModelHistoryProps, I extends SearchState<T, S>> extends BaseComponent<P, I> implements Searchable {
  constructor(props: P,
      protected resourceService: ResourceService,
      protected showMessage: (msg: string) => void,
      getLocale?: () => Locale,
      protected ui?: UIService,
      protected loading?: LoadingService,
      protected listFormId?: string) {
    super(props, getLocale, (ui ? ui.removeError : null));
    this.resource = resourceService.resource();
    this.getModelName = this.getModelName.bind(this);
    this.showMessage = this.showMessage.bind(this);

    this.toggleFilter = this.toggleFilter.bind(this);
    this.load = this.load.bind(this);
    this.add = this.add.bind(this);
    this.getSearchForm = this.getSearchForm.bind(this);
    this.setSearchForm = this.setSearchForm.bind(this);

    this.setSearchModel = this.setSearchModel.bind(this);
    this.getSearchModel = this.getSearchModel.bind(this);
    this.getDisplayFields = this.getDisplayFields.bind(this);

    this.pageSizeChanged = this.pageSizeChanged.bind(this);
    this.clearKeyword = this.clearKeyword.bind(this);
    this.searchOnClick = this.searchOnClick.bind(this);

    this.resetAndSearch = this.resetAndSearch.bind(this);
    this.doSearch = this.doSearch.bind(this);
    this.call = this.call.bind(this);
    this.validateSearch = this.validateSearch.bind(this);
    this.showResults = this.showResults.bind(this);
    this.setList = this.setList.bind(this);
    this.getList = this.getList.bind(this);
    this.sort = this.sort.bind(this);
    this.showMore = this.showMore.bind(this);
    this.pageChanged = this.pageChanged.bind(this);

    this.url = (props.match ? props.match.url : props['props'].match.url);
    /*
    this.locationSearch = '';
    const location = (props.location ? props.location : props['props'].location);
    if (location && location.search) {
      this.locationSearch = location.search;
    }
    */
  }
  protected resource: StringMap;
  protected url: string;

  // Pagination
  initPageSize = 20;
  pageSize = 20;
  pageIndex = 1;
  itemTotal = 0;
  pageTotal = 0;
  showPaging: boolean;
  append: boolean;
  appendMode: boolean;
  appendable: boolean;

  // Sortable
  sortField: string;
  sortType: string;
  sortTarget: HTMLElement;

  keys: string[];
  format?: (obj: T, locale: Locale) => T;
  displayFields: string[];
  initDisplayFields: boolean;
  sequenceNo = 'sequenceNo';
  triggerSearch: boolean;
  tmpPageIndex = 1;

  pageMaxSize = 7;
  pageSizes: number[] = [10, 20, 40, 60, 100, 200, 400, 800];

  private list: T[];
  excluding: any;
  hideFilter: boolean;

  ignoreUrlParam: boolean;
  // locationSearch: string;
  // _currentSortField: string;

  viewable?: boolean = true;
  addable?: boolean = true;
  editable?: boolean = true;
  approvable?: boolean;
  deletable?: boolean;

  protected getModelName(): string {
    return 'model';
  }

  toggleFilter(event: any): void {
    this.hideFilter = !this.hideFilter;
  }
  protected add = (event: any) => {
    event.preventDefault();
    const url = this.props['props'].match.url + '/add';
    this.props.history.push(url);
  }
  load(s: S, autoSearch: boolean): void {
    const obj2 = initSearchable(s, this);
    this.setSearchModel(obj2);
    const com = this;
    if (autoSearch) {
      setTimeout(() => {
        com.doSearch(true);
      }, 0);
    }
  }

  protected setSearchForm(form: HTMLFormElement): void {
    this.form = form;
  }

  protected getSearchForm(): HTMLFormElement {
    if (!this.form && this.listFormId) {
      this.form = document.getElementById(this.listFormId) as HTMLFormElement;
    }
    return this.form;
  }
  setSearchModel(searchModel: S): void {
    this.setState(searchModel as any);
  }
  protected getCurrencyCode(): string {
    return getCurrencyCode(this.form);
  }
  getSearchModel(): S {
    const name = this.getModelName();
    const lc = this.getLocale();
    const cc = this.getCurrencyCode();
    const fields = this.getDisplayFields();
    const l = this.getList();
    const f = this.getSearchForm();
    const dc = (this.ui ? this.ui.decodeFromForm : null);
    const obj3 = getModel<T, S>(this.state, name, this, fields, this.excluding, this.keys, l, f, dc, lc, cc);
    return obj3;
  }
  protected getDisplayFields(): string[] {
    const fs = getDisplayFieldsFromForm(this.displayFields, this.initDisplayFields, this.form);
    this.initDisplayFields = true;
    return fs;
  }

  protected pagingOnClick = (size, e) => {
    this.setState(prevState => ({ isPageSizeOpenDropDown: !(prevState as any).isPageSizeOpenDropDown } as any));
    this.pageSizeChanged(size);
  }

  protected pageSizeOnClick = () => {
    this.setState(prevState => ({ isPageSizeOpenDropDown: !(prevState as any).isPageSizeOpenDropDown } as any));
  }

  protected clearKeyword(): void {
    const m = this.state.model;
    if (m) {
      m.keyword = '';
      this.setState({model: m});
    } else {
      this.setState({
        keyword: ''
      });
    }
  }
  searchOnClick(event: any): void {
    if (event) {
      event.preventDefault();
      if (!this.getSearchForm()) {
        const f = (event.target as HTMLInputElement).form;
        if (f) {
          this.setSearchForm(f);
        }
      }
    }
    this.resetAndSearch();
  }

  resetAndSearch(): void {
    this.pageIndex = 1;
    if (this.running === true) {
      this.triggerSearch = true;
      return;
    }
    reset(this);
    this.tmpPageIndex = 1;
    this.doSearch();
  }

  doSearch(isFirstLoad?: boolean): void {
    const listForm = this.getSearchForm();
    if (listForm && this.ui) {
      this.ui.removeFormError(listForm);
    }
    const s = this.getSearchModel();
    const com = this;
    this.validateSearch(s, () => {
      if (com.running === true) {
        return;
      }
      com.running = true;
      if (this.loading) {
        this.loading.showLoading();
      }
      if (!this.ignoreUrlParam) {
        addParametersIntoUrl(s, isFirstLoad);
      }
      com.call(s);
    });
  }

  call(s: S): void {

  }

  validateSearch(se: S, callback: () => void): void {
    const u = this.ui;
    const vl = (u ? u.validateForm : null);
    validate(se, callback, this.getSearchForm(), this.getLocale(), vl);
  }
  showResults(s: S, sr: SearchResult<T>) {
    const com = this;
    const results = sr.results;
    if (results && results.length > 0) {
      const lc = this.getLocale();
      formatResultsByComponent(results, com, lc);
    }
    const am = com.appendMode;
    showResults2(s, sr, com);
    if (!am) {
      com.setList(results);
      com.tmpPageIndex = s.page;
      const m1 = buildSearchMessage(s, sr, this.resourceService);
      this.showMessage(m1);
    } else {
      if (com.append && s.page > 1) {
        com.appendList(results);
      } else {
        com.setList(results);
      }
    }
    com.running = false;
    if (this.loading) {
      this.loading.hideLoading();
    }
    if (com.triggerSearch) {
      com.triggerSearch = false;
      com.resetAndSearch();
    }
  }

  appendList(results: T[]) {
    const list = this.state.list;
    const arr = append(list, results);

    const listForm = this.getSearchForm();
    const props: any = this.props;
    const setGlobalState = props.props.setGlobalState;
    if (setGlobalState && listForm) {
      setGlobalState({ [listForm.name]: arr });
    } else {
      this.setState({ list: arr });
    }
  }

  setList(list: T[]) {
    const props: any = this.props;
    const setGlobalState = props.props.setGlobalState;
    this.list = list;
    const listForm = this.getSearchForm();
    if (setGlobalState && listForm) {
      setGlobalState({ [listForm.name]: list });
    } else {
      this.setState({ list });
    }
  }

  getList(): T[] {
    return this.list;
  }

  sort(event: any) {
    event.preventDefault();
    handleSortEvent(event, this);
    if (!this.appendMode) {
      this.doSearch();
    } else {
      this.resetAndSearch();
    }
  }
  showMore(event: any) {
    event.preventDefault();
    this.tmpPageIndex = this.pageIndex;
    more(this);
    this.doSearch();
  }
  pageSizeChanged = (event: any) => {
    const size = parseInt((event.currentTarget as HTMLInputElement).value, null);
    changePageSize(this, size);
    this.tmpPageIndex = 1;
    this.doSearch();
  }

  pageChanged(data) {
    const { currentPage, itemsPerPage } = data;
    changePage(this, currentPage, itemsPerPage);
    this.doSearch();
  }
}
export class SearchComponent<T, S extends SearchModel, P extends ModelHistoryProps, I extends SearchState<T, S>> extends BaseSearchComponent<T, S, P, I> {
  constructor(props: P, sv: ((s: S, ctx?: any) => Promise<SearchResult<T>>) | SearchService<T, S>,
      param: ResourceService|SearchParameter,
      showMessage?: (msg: string, option?: string) => void,
      showError?: (m: string, header?: string, detail?: string, callback?: () => void) => void,
      getLocale?: (profile?: string) => Locale,
      uis?: UIService,
      loading?: LoadingService,
      listFormId?: string) {
    super(props, getResource(param), getMsgFunc(param, showMessage), getLocaleFunc(param, getLocale), getUIService(param, uis), getLoadingFunc(param, loading), listFormId);
    this.autoSearch = getAutoSearch(param);
    if (sv) {
      if (typeof sv === 'function') {
        const x: any = sv;
        this.search = x;
      } else {
        this.service = sv;
        if (this.service.keys) {
          this.keys = this.service.keys();
        }
      }
    }
    this.call = this.call.bind(this);
    this.showError = getErrorFunc(param, showError);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.mergeSearchModel = this.mergeSearchModel.bind(this);
    this.createSearchModel = this.createSearchModel.bind(this);
    this.ref = React.createRef();
  }
  protected showError: (m: string, header?: string, detail?: string, callback?: () => void) => void;
  protected search?: (s: S, ctx?: any) => Promise<SearchResult<T>>;
  protected service: SearchService<T, S>;
  protected ref: any;
  protected autoSearch: boolean;
  componentDidMount() {
    const k = (this.ui ? this.ui.registerEvents : null);
    this.form = initForm(this.ref.current, k);
    const s = this.mergeSearchModel(buildFromUrl<S>(), this.createSearchModel());
    this.load(s, this.autoSearch);
  }
  mergeSearchModel(obj: S, b?: S, arrs?: string[]|any): S {
    return mergeSearchModel2<S>(obj, b, this.pageSizes, arrs);
  }
  createSearchModel(): S {
    const s: any = {};
    return s;
  }
  async call(s: S) {
    try {
      this.running = true;
      if (this.loading) {
        this.loading.showLoading();
      }
      if (this.search) {
        const sr = await this.search(s);
        this.showResults(s, sr);
      } else {
        const sr = await this.service.search(s);
        this.showResults(s, sr);
      }
    } catch (err) {
      this.pageIndex = this.tmpPageIndex;
      error(err, this.resourceService.value, this.showError);
    } finally {
      this.running = false;
      if (this.loading) {
        this.loading.hideLoading();
      }
    }
  }
}

export abstract class BaseEditComponent<T, P extends ModelHistoryProps, S> extends BaseComponent<P, S> {
  constructor(props: P,
      protected resourceService: ResourceService,
      protected showMessage: (msg: string) => void,
      protected showError: (m: string, title?: string, detail?: string, callback?: () => void) => void,
      protected confirm: (m2: string, header: string, yesCallback?: () => void, btnLeftText?: string, btnRightText?: string, noCallback?: () => void) => void,
      getLocale?: () => Locale,
      protected ui?: UIService,
      protected loading?: LoadingService,
      protected status?: EditStatusConfig,
      patchable?: boolean, backOnSaveSuccess?: boolean) {
    super(props, getLocale, (ui ? ui.removeError : null));
    this.resource = resourceService.resource();
    if (patchable === false) {
      this.patchable = patchable;
    }
    if (backOnSaveSuccess === false) {
      this.backOnSuccess = backOnSaveSuccess;
    }
    this.insertSuccessMsg = resourceService.value('msg_save_success');
    this.updateSuccessMsg = resourceService.value('msg_save_success');

    this.showMessage = this.showMessage.bind(this);
    this.showError = this.showError.bind(this);
    this.confirm = this.confirm.bind(this);

    this.back = this.back.bind(this);
    this.getModelName = this.getModelName.bind(this);

    this.resetState = this.resetState.bind(this);
    this.handleNotFound = this.handleNotFound.bind(this);
    this.showModel = this.showModel.bind(this);
    this.getModel = this.getModel.bind(this);
    this.createModel = this.createModel.bind(this);

    this.newOnClick = this.newOnClick.bind(this);
    this.saveOnClick = this.saveOnClick.bind(this);
    this.onSave = this.onSave.bind(this);
    this.validate = this.validate.bind(this);
    this.save = this.save.bind(this);
    this.succeed = this.succeed.bind(this);
    this.fail = this.fail.bind(this);
    this.postSave = this.postSave.bind(this);
    this.handleDuplicateKey = this.handleDuplicateKey.bind(this);
  }
  protected backOnSuccess = true;
  protected resource: StringMap;
  protected metadata?: Metadata;
  protected keys?: string[];
  protected version?: string;
  protected newMode: boolean;
  protected setBack: boolean;
  protected patchable = true;
  protected orginalModel: T;

  addable?: boolean = true;
  readOnly?: boolean;
  deletable?: boolean;

  insertSuccessMsg: string;
  updateSuccessMsg: string;
  protected back(event: any) {
    if (event) {
      event.preventDefault();
    }
    this.props.history.goBack();
  }
  protected resetState(newMod: boolean, model: T, originalModel: T) {
    this.newMode = newMod;
    this.orginalModel = originalModel;
    this.showModel(model);
  }
  protected handleNotFound(form?: HTMLFormElement): void {
    const msg = message(this.resourceService.value, 'error_not_found', 'error');
    if (form) {
      readOnly(form);
    }
    this.showError(msg.message, msg.title);
  }
  protected getModelName(f?: HTMLFormElement): string {
    if (this.metadata) {
      return this.metadata.name;
    }
    return super.getModelName(f);
  }
  getModel(): T {
    const n = this.getModelName();
    return this.props[n] || this.state[n];
  }
  showModel(model: T) {
    const f = this.form;
    const modelName = this.getModelName();
    const objSet: any = {};
    objSet[modelName] = model;
    this.setState(objSet, () => {
      if (this.readOnly) {
        readOnly(f);
      }
    });
  }

  // end of: can be in ViewComponent
  protected createModel(): T {
    if (this.metadata) {
      const obj = createModel2<T>(this.metadata);
      return obj;
    } else {
      const obj: any = {};
      return obj;
    }
  }

  newOnClick = (event: any) => {
    if (event) {
      event.preventDefault();
    }
    if (!this.form && event && event.target && (event.target as HTMLInputElement).form) {
      this.form = (event.target as HTMLInputElement).form;
    }
    const obj = this.createModel();
    this.resetState(true, obj, null);
    const u = this.ui;
    if (u) {
      const f = this.form;
      setTimeout(() => {
        u.removeFormError(f);
      }, 100);
    }
  }
  protected saveOnClick = (event: any) => {
    event.preventDefault();
    (event as any).persist();
    if (!this.form && event && event.target) {
      this.form = (event.target as HTMLInputElement).form;
    }
    this.onSave(this.backOnSuccess);
  }
  onSave(isBack?: boolean) {
    const r = this.resourceService;
    if (this.newMode && !this.addable) {
      const m = message(r.value, 'error_permission_add', 'error_permission');
      this.showError(m.message, m.title);
      return;
    } else if (!this.newMode && this.readOnly) {
      const msg = message(r.value, 'error_permission_edit', 'error_permission');
      this.showError(msg.message, msg.title);
      return;
    } else {
      if (this.running) {
        return;
      }
      const com = this;
      const obj = com.getModel();
      if (this.newMode) {
        com.validate(obj, () => {
          const msg = message(r.value, 'msg_confirm_save', 'confirm', 'yes', 'no');
          this.confirm(msg.message, msg.title, () => {
            com.save(obj, obj, isBack);
          }, msg.no, msg.yes);
        });
      } else {
        const diffObj = makeDiff(initPropertyNullInModel(this.orginalModel, this.metadata), obj, this.keys, this.version);
        const keys = Object.keys(diffObj);
        if (keys.length === 0) {
          this.showMessage(r.value('msg_no_change'));
        } else {
          com.validate(obj, () => {
            const msg = message(r.value, 'msg_confirm_save', 'confirm', 'yes', 'no');
            this.confirm(msg.message, msg.title, () => {
              com.save(obj, diffObj, isBack);
            }, msg.no, msg.yes);
          });
        }
      }
    }
  }
  protected validate(obj: T, callback: (obj2?: T) => void) {
    if (this.ui) {
      const valid = this.ui.validateForm(this.form, this.getLocale());
      if (valid) {
        callback(obj);
      }
    } else {
      callback(obj);
    }
  }

  protected save(obj: T, diff?: T, isBack?: boolean) {
  }

  protected succeed(msg: string, isBack?: boolean, result?: ResultInfo<T>) {
    if (result) {
      const model = result.value;
      this.newMode = false;
      if (model && this.setBack) {
        this.resetState(false, model, clone(model));
      } else {
        handleVersion(this.getModel(), this.version);
      }
    } else {
      handleVersion(this.getModel(), this.version);
    }
    const isBackO = (isBack == null || isBack === undefined ? this.backOnSuccess : isBack);
    this.showMessage(msg);
    if (isBackO) {
      this.back(null);
    }
  }
  protected fail(result: ResultInfo<T>) {
    const errors = result.errors;
    const f = this.form;
    const u = this.ui;
    if (u) {
      const unmappedErrors = u.showFormError(f, errors);
      if (!result.message) {
        if (errors && errors.length === 1) {
          result.message = errors[0].message;
        } else {
          result.message = u.buildErrorMessage(unmappedErrors);
        }
      }
      focusFirstError(f);
    } else if (errors && errors.length === 1) {
      result.message = errors[0].message;
    }
    const t = this.resourceService.value('error');
    this.showError(result.message, t);
  }

  protected postSave(res: number|string|ResultInfo<T>, backOnSave?: boolean) {
    this.running = false;
    if (this.loading) {
      this.loading.hideLoading();
    }
    const st = this.status;
    const newMod = this.newMode;
    const successMsg = (newMod ? this.insertSuccessMsg : this.updateSuccessMsg);
    const x: any = res;
    const r = this.resourceService;
    if (!isNaN(x)) {
      if (x === st.Success) {
        this.succeed(successMsg, backOnSave);
      } else {
        if (newMod && x === st.DuplicateKey) {
          this.handleDuplicateKey();
        } else if (!newMod && x === st.NotFound) {
          this.handleNotFound();
        } else {
          handleStatus(x as number, st, r.value, this.showError);
        }
      }
    } else {
      const result: ResultInfo<T> = x;
      if (result.status === st.Success) {
        this.succeed(successMsg, backOnSave, result);
        this.showMessage(successMsg);
      } else if (result.errors && result.errors.length > 0) {
        this.fail(result);
      } else if (newMod && result.status === st.DuplicateKey) {
        this.handleDuplicateKey(result);
      } else if (!newMod && x === st.NotFound) {
        this.handleNotFound();
      } else {
        handleStatus(result.status, st, r.value, this.showError);
      }
    }
  }
  protected handleDuplicateKey(result?: ResultInfo<T>) {
    const msg = message(this.resourceService.value, 'error_duplicate_key', 'error');
    this.showError(msg.message, msg.title);
  }
}
export class EditComponent<T, ID, P extends ModelHistoryProps, S> extends BaseEditComponent<T, P, S>  {
  constructor(props: P, protected service: GenericService<T, ID, number|ResultInfo<T>>,
      param: ResourceService|EditParameter,
      showMessage?: (msg: string, option?: string) => void,
      showError?: (m: string, title?: string, detail?: string, callback?: () => void) => void,
      confirm?: (m2: string, header: string, yesCallback?: () => void, btnLeftText?: string, btnRightText?: string, noCallback?: () => void) => void,
      getLocale?: (profile?: string) => Locale,
      uis?: UIService,
      loading?: LoadingService, status?: EditStatusConfig, patchable?: boolean, backOnSaveSuccess?: boolean) {
    super(props, getResource(param), getMsgFunc(param, showMessage), getErrorFunc(param, showError), getConfirmFunc(param, confirm), getLocaleFunc(param, getLocale), getUIService(param, uis), getLoadingFunc(param, loading), getEditStatusFunc(param, status), patchable, backOnSaveSuccess);
    if (service.metadata) {
      const metadata = service.metadata();
      if (metadata) {
        const meta = build(metadata);
        this.keys = meta.keys;
        this.version = meta.version;
        this.metadata = metadata;
      }
    }
    if (!this.keys && service.keys) {
      const k = service.keys();
      if (k) {
        this.keys = k;
      }
    }
    if (!this.keys) {
      this.keys = [];
    }
    this.load = this.load.bind(this);
    this.save = this.save.bind(this);
    this.componentDidMount = this.componentDidMount.bind(this);
    this.ref = React.createRef();
  }
  protected ref: any;
  componentDidMount() {
    const k = (this.ui ? this.ui.registerEvents : null);
    this.form = initForm(this.ref.current, k);
    const id = buildId<ID>(this.props, this.keys);
    this.load(id);
  }
  async load(_id: ID, callback?: (m: T, showM: (m2: T) => void) => void) {
    const id: any = _id;
    if (id != null && id !== '') {
      try {
        this.running = true;
        if (this.loading) {
          this.loading.showLoading();
        }
        const ctx: any = {};
        const obj = await this.service.load(id, ctx);
        if (!obj) {
          this.handleNotFound(this.form);
        } else {
          this.newMode = false;
          this.orginalModel = clone(obj);
          if (!callback) {
            this.showModel(obj);
          } else {
            callback(obj, this.showModel);
          }
        }
      } catch (err) {
        const data = (err &&  err.response) ? err.response : err;
        const r = this.resourceService;
        const gv = r.value;
        const title = gv('error');
        let msg = gv('error_internal');
        if (data && data.status === 404) {
          this.handleNotFound(this.form);
        } else {
          if (data.status && !isNaN(data.status)) {
            msg = messageByHttpStatus(data.status, gv);
          }
          if (data && (data.status === 401 || data.status === 403)) {
            readOnly(this.form);
          }
          this.showError(msg, title);
        }
      } finally {
        this.running = false;
        if (this.loading) {
          this.loading.hideLoading();
        }
      }
    } else {
      // Call service state
      this.newMode = true;
      this.orginalModel = null;
      const obj = this.createModel();
      if (callback) {
        callback(obj, this.showModel);
      } else {
        this.showModel(obj);
      }
    }
  }
  protected async save(obj: T, body?: T, isBack?: boolean) {
    this.running = true;
    if (this.loading) {
      this.loading.showLoading();
    }
    const isBackO = (isBack == null || isBack === undefined ? this.backOnSuccess : isBack);
    const com = this;
    try {
      const ctx: any = {};
      if (!this.newMode) {
        if (this.patchable === true && this.service.patch && body && Object.keys(body).length > 0) {
          const result = await this.service.patch(body, ctx);
          com.postSave(result, isBackO);
        } else {
          const result = await this.service.update(obj, ctx);
          com.postSave(result, isBackO);
        }
      } else {
        const result = await this.service.insert(obj, ctx);
        com.postSave(result, isBackO);
      }
    } catch (err) {
      error(err, this.resourceService.value, this.showError);
    } finally {
      this.running = false;
      if (this.loading) {
        this.loading.hideLoading();
      }
    }
  }
}
