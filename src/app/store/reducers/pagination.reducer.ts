import { Action, Store } from '@ngrx/store';
import { denormalize, Schema } from 'normalizr';

import { ApiActionTypes } from '../actions/api.actions';
import {
  ADD_PARAMS,
  AddParams,
  CLEAR_PAGES,
  CLEAR_PAGINATION_OF_TYPE,
  REMOVE_PARAMS,
  RemoveParams,
  selectPaginationState,
  SET_PAGE,
  SET_PARAMS,
  SetPage,
  SetParams,
} from '../actions/pagination.actions';
import { AppState } from '../app-state';
import { APIAction, getEntityState } from './../actions/api.actions';
import { mergeState } from './../helpers/reducer.helper';
import { Observable } from 'rxjs/Observable';
import { defaultEntitiesState } from './entity.reducer';


export const resultPerPageParam = 'results-per-page';
export const resultPerPageParamDefault = 5;

export function qParamsToString(params: QParam[]) {
  const qStrings = params.map(joinQParam);
  return qStrings.join('%3A');
}

function joinQParam(q: QParam) {
  return `${q.key}${q.joiner}${(q.value as string[]).join ? (q.value as string[]).join(',') : q.value}`;
}

export class QParam {
  constructor(
    public key: string,
    public value: string | string[],
    public joiner: '>=' | '<=' | '<' | '>' | '%2BIN%2B' | ':' | '=' = ':'
  ) { }
}

export interface PaginationParam {
  q?: QParam[];
  [entityKey: string]: any;
}

export class PaginationEntityState {
  currentPage = 0;
  totalResults = 0; // TODO: Populate
  pageCount = 0;
  ids = {};
  params: PaginationParam;
  fetching: boolean;
  error: boolean;
  message: string;
}

// An action that is intended to begin a
export interface PaginatedAction extends PaginationAction, APIAction {
  initialParams?: PaginationParam;
}
export interface PaginationAction extends Action {
  entityKey: string;
  paginationKey: string;
}

export interface PaginationEntityTypeState {
  [paginationKey: string]: PaginationEntityState;
}

export interface PaginationState {
  [entityKey: string]: PaginationEntityTypeState;
}

const types = [
  ApiActionTypes.API_REQUEST_START,
  ApiActionTypes.API_REQUEST_SUCCESS,
  ApiActionTypes.API_REQUEST_FAILED
];

const [requestType, successType, failureType] = types;

const defaultPaginationEntityState = {
  fetching: false,
  pageCount: 0,
  currentPage: 1,
  totalResults: 0,
  ids: {},
  params: {
    [resultPerPageParam]: resultPerPageParamDefault
  },
  error: false,
  message: ''
};

const updatePagination =
  function (state: PaginationEntityState = defaultPaginationEntityState, action, actionType): PaginationEntityState {
    switch (actionType) {
      case requestType:
        return {
          ...state,
          fetching: true,
          error: false,
          message: '',
        };
      case successType:
        const params = {};
        const { apiAction } = action;
        if (apiAction.options.params) {
          apiAction.options.params.paramsMap.forEach((value, key) => {
            const paramValue = value.length === 1 ? value[0] : value;
            params[key] = paramValue;
          });
        }
        return {
          ...state,
          fetching: false,
          error: false,
          message: '',
          ids: {
            ...state.ids,
            [state.currentPage]: action.response.result
          },
          pageCount: state.pageCount + 1,
          totalResults: action.totalResults || action.response.result.length
        };
      case failureType:
        return {
          ...state,
          fetching: false,
          error: true,
          message: action.message
        };
      case SET_PAGE:
        return {
          ...state,
          error: false,
          currentPage: (action as SetPage).pageNumber
        };
      case SET_PARAMS:

        return {
          ...state,
          params: {
            [resultPerPageParam]: resultPerPageParamDefault,
            ...(action as SetParams).params,
            q: getUniqueQParams(action as SetParams, state)
          }
        };
      case ADD_PARAMS:
        const addParamAction = action as AddParams;
        return {
          ...state,
          params: {
            ...state.params,
            ...addParamAction.params,
            q: getUniqueQParams(addParamAction, state)
          }
        };
      case REMOVE_PARAMS:
        const removeParamsState = { ...state };
        (action as RemoveParams).params.forEach((key) => {
          if (removeParamsState.params.hasOwnProperty(key)) {
            delete removeParamsState.params[key];
          }
        });
        return removeParamsState;
      default:
        return state;
    }
  };

function getUniqueQParams(action: AddParams | SetParams, state) {
  let qParmas = [].concat(state.params.q || []);
  // Ensure q params are unique
  if (action.params.q) {
    qParmas = qParmas.concat(action.params.q).filter((thing, index, self) => self.findIndex(
      (t) => {
        return t.key === thing.key;
      }
    ) === index);
  }
  return qParmas;
}



function getActionType(action) {
  return action.apiType || action.type;
}

function getAction(action): PaginatedAction {
  if (!action) {
    return null;
  }
  return action.apiAction ? action.apiAction : action;
}

function getActionKey(action) {
  const apiAction = getAction(action);
  return apiAction.entityKey || null;
}

function getPaginationKey(action) {
  const apiAction = getAction(action);
  return apiAction.paginationKey;
}

export function getPaginationObservables(
  { store, action, schema }: { store: Store<AppState>, action: PaginatedAction, schema: Schema }
) {
  const { entityKey, paginationKey } = action;

  if (action.initialParams) {
    store.dispatch(new SetParams(entityKey, paginationKey, action.initialParams));
  }

  const paginationSelect$ = store.select(selectPaginationState(entityKey, paginationKey));

  const pagination$ = paginationSelect$
    .filter(pagination => !!pagination);

  const entities$ = paginationSelect$
    .do(pagination => {
      if (!hasError(pagination) && !hasValidOrGettingPage(pagination)) {
        store.dispatch(action);
      }
    })
    .filter(pagination => {
      return isPageReady(pagination);
    })
    .withLatestFrom(store.select(getEntityState))
    .map(([paginationEntity, entities]) => {
      const page = paginationEntity.ids[paginationEntity.currentPage];
      return page ? denormalize(page, schema, entities) : null;
    });

  return {
    pagination$,
    entities$
  };
}

function isPageReady(pagination: PaginationEntityState) {
  return !!pagination && !!pagination.ids[pagination.currentPage];
}

function hasValidOrGettingPage(pagination: PaginationEntityState) {
  if (pagination && Object.keys(pagination).length) {
    const hasPage = !!pagination.ids[pagination.currentPage];

    return pagination.fetching || hasPage;
  } else {
    return false;
  }
}

function hasError(pagination: PaginationEntityState) {
  return pagination && pagination.error;
}

export function paginationReducer(state = defaultEntitiesState, action) {
  if (action.type === ApiActionTypes.API_REQUEST) {
    return state;
  }

  if (action.type === CLEAR_PAGES) {
    if (state[action.entityKey] && state[action.entityKey][action.paginationKey]) {
      const newState = { ...state };
      const entityState = {
        ...newState[action.entityKey],
        [action.paginationKey]: {
          ...newState[action.entityKey][action.paginationKey],
          ids: {},
          fetching: false,
          pageCount: 0,
          currentPage: 1,
          totalResults: 0,
          error: false,
          message: ''
        }
      };
      return {
        ...newState,
        [action.entityKey]: entityState
      };
    }
  }

  if (action.type === CLEAR_PAGINATION_OF_TYPE) {
    if (state[action.entityKey]) {
      const clearState = { ...state };
      clearState[action.entityKey] = {};
      return clearState;
    }
    return state;
  }

  const actionType = getActionType(action);
  const key = getActionKey(action);
  const paginationKey = getPaginationKey(action);
  if (actionType && key && paginationKey) {
    const newState = { ...state };

    const updatedPaginationState = updatePagination(newState[key][paginationKey], action, actionType);
    newState[key] = mergeState(newState[key], {
      [paginationKey]: updatedPaginationState
    });
    return newState;
  } else {
    return state;
  }
}
