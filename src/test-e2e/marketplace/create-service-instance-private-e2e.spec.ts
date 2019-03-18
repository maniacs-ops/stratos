import { e2e } from '../e2e';
import { ConsoleUserType } from '../helpers/e2e-helpers';
import { CreateServiceInstance } from './create-service-instance.po';
import { ServicesHelperE2E } from './services-helper-e2e';
import { ServicesWallPage } from './services-wall.po';
import { extendE2ETestTime } from '../helpers/extend-test-helpers';

describe('Create Service Instance of Private Service', () => {
  const createServiceInstance = new CreateServiceInstance();
  let createMarketplaceServiceInstance;
  let e2eSetup;
  const servicesWall = new ServicesWallPage();
  let servicesHelperE2E: ServicesHelperE2E;
  beforeAll(() => {
    e2eSetup = e2e.setup(ConsoleUserType.admin)
      .clearAllEndpoints()
      .registerDefaultCloudFoundry()
      .connectAllEndpoints(ConsoleUserType.admin)
      .getInfo();

  });

  beforeEach(() => {
    createServiceInstance.navigateTo();
    createServiceInstance.waitForPage();
    createMarketplaceServiceInstance = createServiceInstance.selectMarketplace();
    servicesHelperE2E = new ServicesHelperE2E(e2eSetup, createMarketplaceServiceInstance);
  });

  it('- should reach create service instance page', () => {
    expect(createMarketplaceServiceInstance.isActivePage()).toBeTruthy();
  });

  describe('Long running tests - ', () => {
    const timeout = 100000;
    extendE2ETestTime(timeout);

    it('- should be able to to create a service instance', () => {

      servicesHelperE2E.createService(e2e.secrets.getDefaultCFEndpoint().services.privateService.name, false);

      servicesWall.waitForPage();

      servicesHelperE2E.getServiceCardWithTitle(servicesWall.serviceInstancesList, servicesHelperE2E.serviceInstanceName);

    }, timeout);
  });

  it('- should return user to Service summary when cancelled on CFOrgSpace selection', () => {

    // Select CF/Org/Space
    servicesHelperE2E.setCfOrgSpace();
    createMarketplaceServiceInstance.stepper.cancel();

    servicesWall.waitForPage();

  });

  it('- should return user to Service summary when cancelled on Service selection', () => {

    // Select CF/Org/Space
    servicesHelperE2E.setCfOrgSpace();
    createMarketplaceServiceInstance.stepper.next();

    // Select Service
    servicesHelperE2E.setServiceSelection(e2e.secrets.getDefaultCFEndpoint().services.privateService.name);
    createMarketplaceServiceInstance.stepper.next();

    createMarketplaceServiceInstance.stepper.cancel();

    servicesWall.waitForPage();

  });

  it('- should not show service plan if wrong org/space are selected', () => {

    // Select CF/Org/Space
    servicesHelperE2E.setCfOrgSpace(e2e.secrets.getDefaultCFEndpoint().services.privateService.invalidOrgName,
      e2e.secrets.getDefaultCFEndpoint().services.privateService.invalidSpaceName);
    createMarketplaceServiceInstance.stepper.next();

    // Select Service
    servicesHelperE2E.setServiceSelection(e2e.secrets.getDefaultCFEndpoint().services.privateService.name, true);

  });

  afterAll(() => servicesHelperE2E.cleanUpServiceInstance(servicesHelperE2E.serviceInstanceName));
});
