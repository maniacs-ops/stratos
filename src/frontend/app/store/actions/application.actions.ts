import { Headers, RequestOptions, URLSearchParams } from '@angular/http';

import { IApp } from '../../core/cf-api.types';
import {
  applicationSchemaKey,
  appStatsSchemaKey,
  domainSchemaKey,
  entityFactory,
  routeSchemaKey,
} from '../helpers/entity-factory';
import {
  createEntityRelationKey,
  EntityInlineChildAction,
  EntityInlineParentAction,
} from '../helpers/entity-relations.types';
import { pick } from '../helpers/reducer.helper';
import { ActionMergeFunction } from '../types/api.types';
import { PaginatedAction } from '../types/pagination.types';
import { ICFAction } from '../types/request.types';
import { CFStartAction } from './../types/request.types';
import { AppMetadataTypes } from './app-metadata.actions';
import { getPaginationKey } from './pagination.actions';

export const GET_ALL = '[Application] Get all';
export const GET_ALL_SUCCESS = '[Application] Get all success';
export const GET_ALL_FAILED = '[Application] Get all failed';

export const GET = '[Application] Get one';
export const GET_SUCCESS = '[Application] Get one success';
export const GET_FAILED = '[Application] Get one failed';

export const GET_SUMMARY = '[Application] Get summary';
export const GET_SUMMARY_SUCCESS = '[Application] Get summary success';
export const GET_SUMMARY_FAILED = '[Application] Get summary failed';

export const CREATE = '[Application] Create';
export const CREATE_SUCCESS = '[Application] Create success';
export const CREATE_FAILED = '[Application] Create failed';

export const UPDATE = '[Application] Update';
export const UPDATE_SUCCESS = '[Application] Update success';
export const UPDATE_FAILED = '[Application] Update failed';

export const ASSIGN_ROUTE = '[Application] Assign route';
export const ASSIGN_ROUTE_SUCCESS = '[Application] Assign route success';
export const ASSIGN_ROUTE_FAILED = '[Application] Assign route failed';

export const DELETE = '[Application] Delete';
export const DELETE_SUCCESS = '[Application] Delete success';
export const DELETE_FAILED = '[Application] Delete failed';

export const DELETE_INSTANCE = '[Application Instance] Delete';
export const DELETE_INSTANCE_SUCCESS = '[Application Instance] Delete success';
export const DELETE_INSTANCE_FAILED = '[Application Instance] Delete failed';

const applicationEntitySchema = entityFactory(applicationSchemaKey);

export class GetAllApplications extends CFStartAction implements PaginatedAction, EntityInlineParentAction {
  private static sortField = 'creation'; // This is the field that 'order-direction' is applied to. Cannot be changed

  constructor(public paginationKey: string, public includeRelations = [], public populateMissing = false) {
    super();
    this.options = new RequestOptions();
    this.options.url = 'apps';
    this.options.method = 'get';
  }
  actions = [GET_ALL, GET_ALL_SUCCESS, GET_ALL_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
  initialParams = {
    'order-direction': 'asc',
    'order-direction-field': GetAllApplications.sortField,
    page: 1,
    'results-per-page': 50,
  };
  flattenPagination = true;
}

export class GetApplication extends CFStartAction implements ICFAction, EntityInlineParentAction {
  constructor(public guid: string, public endpointGuid: string, public includeRelations = [], public populateMissing = true) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${guid}`;
    this.options.method = 'get';
  }
  actions = [GET, GET_SUCCESS, GET_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
}

export class CreateNewApplication extends CFStartAction implements ICFAction {
  constructor(
    public guid: string,
    public endpointGuid: string,
    application: IApp
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps`;
    this.options.method = 'post';
    this.options.body = {
      name: application.name,
      space_guid: application.space_guid
    };
  }
  actions = [CREATE, CREATE_SUCCESS, CREATE_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
}

export class AssociateRouteWithAppApplication extends CFStartAction
  implements ICFAction {
  constructor(
    public guid: string,
    public routeGuid: string,
    public endpointGuid: string
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${guid}/routes/${routeGuid}`;
    this.options.method = 'put';
  }
  actions = [ASSIGN_ROUTE, ASSIGN_ROUTE_SUCCESS, ASSIGN_ROUTE_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
  updatingKey = 'Assigning-Route';
}

export interface UpdateApplication {
  name?: string;
  instances?: number;
  memory?: number;
  enable_ssh?: boolean;
  environment_json?: any;
  state?: string;
}

export class UpdateExistingApplication extends CFStartAction
  implements ICFAction {
  static updateKey = 'Updating-Existing-Application';

  constructor(
    public guid: string,
    public endpointGuid: string,
    private application: UpdateApplication,
    public updateEntities?: AppMetadataTypes[]
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${guid}`;
    this.options.method = 'put';
    this.options.body = application;
  }
  actions = [UPDATE, UPDATE_SUCCESS, UPDATE_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
  updatingKey = UpdateExistingApplication.updateKey;
  entityMerge: ActionMergeFunction = (oldEntities, newEntities) => {
    const keepFromOld = pick(
      oldEntities[applicationSchemaKey][this.guid].entity,
      Object.keys(applicationEntitySchema['schema']) as [string]
    );
    newEntities[applicationSchemaKey][this.guid].entity = {
      ...newEntities[applicationSchemaKey][this.guid].entity,
      ...keepFromOld
    };
    return newEntities;
  }
}

export class DeleteApplication extends CFStartAction implements ICFAction {
  static updateKey = 'Deleting-Existing-Application';

  constructor(public guid: string, public endpointGuid: string) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${guid}`;
    this.options.method = 'delete';
    this.options.headers = new Headers();
    const endpointPassthroughHeader = 'x-cap-passthrough';
    this.options.headers.set(endpointPassthroughHeader, 'true');
  }
  actions = [DELETE, DELETE_SUCCESS, DELETE_FAILED];
  entity = [applicationEntitySchema];
  entityKey = applicationSchemaKey;
  options: RequestOptions;
}

export class DeleteApplicationInstance extends CFStartAction
  implements ICFAction {
  guid: string;
  constructor(
    public appGuid: string,
    private index: number,
    public endpointGuid: string
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${appGuid}/instances/${index}`;
    this.options.method = 'delete';
    this.options.headers = new Headers();
    const endpointPassthroughHeader = 'x-cap-passthrough';
    this.options.headers.set(endpointPassthroughHeader, 'true');
    this.guid = `${appGuid}-${index}`;
  }
  actions = [DELETE_INSTANCE, DELETE_INSTANCE_SUCCESS, DELETE_INSTANCE_FAILED];
  entity = [entityFactory(appStatsSchemaKey)];
  entityKey = appStatsSchemaKey;
  removeEntityOnDelete = true;
  options: RequestOptions;
}

export class GetAppRoutes extends CFStartAction implements EntityInlineParentAction, EntityInlineChildAction {
  constructor(
    public guid: string,
    public endpointGuid: string,
    public paginationKey: string = null,
    public includeRelations: string[] = [
      createEntityRelationKey(routeSchemaKey, domainSchemaKey)
    ],
    public populateMissing = true
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = `apps/${guid}/routes`;
    this.options.method = 'get';
    this.options.params = new URLSearchParams();
    this.parentGuid = guid;
    this.paginationKey = paginationKey || getPaginationKey(this.entityKey, endpointGuid, guid);
  }
  actions = [
    '[Application Routes] Get all',
    '[Application Routes] Get all success',
    '[Application Routes] Get all failed',
  ];
  initialParams = {
    'results-per-page': 100,
    page: 1,
    'order-direction': 'desc',
    'order-direction-field': 'route',
  };
  entity = [entityFactory(routeSchemaKey)];
  entityKey = routeSchemaKey;
  options: RequestOptions;
  flattenPagination = true;
  parentGuid: string;
  parentEntitySchema = entityFactory(applicationSchemaKey);
}
