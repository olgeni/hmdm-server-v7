import { computed, effect, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog } from 'hmdm-ui-kit';
import { filter, finalize, map, Observable, of, switchMap, take, tap } from 'rxjs';
import { SnackBarService } from '../../shared/services/snack-bar.service';
import { TOption, TTableSortState } from '../../../../../hmdm-ui-kit/src/public-api';
import { ApplicationService } from '../../entity/application/services/application.service';
import { TApplicationDTO } from '../../entity/application/types/application-dto.type';
import { TVersionDTO } from '../../entity/application/types/version-dto.type';
import { ConfigurationService } from '../../entity/configuration/services/configuration.service';
import { APP_ACTION } from '../const/app-action.const';
import { ConfigurationDetailsFacadeService } from './configuration-details-facade.service';
import { TConfigurationAppDetailsFormValue } from '../types/configuration-app-details-form.type';

function toKeyCode(value: string): number | null {
  const parsed = Number(value);

  return value === '' || Number.isNaN(parsed) ? null : parsed;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigurationAppsFacadeService {
  private configurationService = inject(ConfigurationService);
  private configurationDetailsFacadeService = inject(ConfigurationDetailsFacadeService);
  private applicationService = inject(ApplicationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBarService = inject(SnackBarService);
  private searchTerm: WritableSignal<string> = signal('');

  private readonly showSystemApps: WritableSignal<boolean> = signal(false);
  private readonly _sortState: WritableSignal<TTableSortState | null> = signal(null);
  private readonly _applications: WritableSignal<TApplicationDTO[]> = signal([]);
  private readonly _allApplications: WritableSignal<TApplicationDTO[]> = signal([]);
  // Versions of each app, loaded the first time its version picker is opened after the
  // configuration loads
  private readonly versionsCache = new Map<number, TVersionDTO[]>();

  applications = this._applications.asReadonly();
  isLoadingApplications: WritableSignal<boolean> = signal(false);
  tableData = computed(() => {
    const apps = this._applications().filter((app) => {
      return this.isListed(app) && (this.showSystemApps() || !app.system);
    });

    if (this._sortState()) {
      const { sortBy, sortDir } = this._sortState()!;

      apps.sort((a, b) => {
        const aValue = a[sortBy as keyof TApplicationDTO];
        const bValue = b[sortBy as keyof TApplicationDTO];

        if (aValue === bValue) {
          return 0;
        }

        const comparison = aValue! > bValue! ? 1 : -1;
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }

    return this.searchTerm()
      ? apps.filter((app) => app.name.toLowerCase().includes(this.searchTerm().toLowerCase()))
      : apps;
  });
  applicationsOptions = computed(() =>
    this._allApplications().map((app) => ({
      viewValue: app.name,
      value: app,
    })),
  );
  applicationsIdOptions = computed(() =>
    this._allApplications().map((app) => ({
      viewValue: app.pkg ? `${app.name} (${app.pkg})` : app.name,
      value: app.id,
    })),
  );
  applicationsVersionIdOptions = computed(() => {
    // Prefer the version used in the current configuration over the latest one.
    // An app may appear several times, but only one entry carries usedVersionId,
    // so skip the null entries to keep them from overwriting it in the map
    const configVersions = new Map(
      this._applications()
        .filter((app) => app.usedVersionId != null)
        .map((app) => [app.id, app.usedVersionId]),
    );

    return this._allApplications().map((app) => ({
      viewValue: app.pkg ? `${app.name} (${app.pkg})` : app.name,
      value: configVersions.get(app.id) ?? app.usedVersionId,
    }));
  });

  // Package of the configuration's main (MDM) app; follows an unsaved change on the MDM tab.
  // mainAppId is a version id, so find the app that version belongs to
  private readonly mainAppPkg = computed(() => {
    const mainAppId = this.configurationDetailsFacadeService.currentConfiguration()?.mainAppId;

    if (!mainAppId) {
      return null;
    }

    const isMainVersion = (app: TApplicationDTO) =>
      app.usedVersionId === mainAppId || app.latestVersion === mainAppId;
    const mainApp =
      this._applications().find(isMainVersion) ?? this._allApplications().find(isMainVersion);

    return mainApp?.pkg || null;
  });

  // Package of the configuration's content app; follows an unsaved change on the MDM tab.
  // contentAppId is a version id, so find the app that version belongs to
  private readonly contentAppPkg = computed(() => {
    const contentAppId =
      this.configurationDetailsFacadeService.currentConfiguration()?.contentAppId;

    if (!contentAppId) {
      return null;
    }

    const isContentVersion = (app: TApplicationDTO) =>
      app.usedVersionId === contentAppId || app.latestVersion === contentAppId;
    const contentApp =
      this._applications().find(isContentVersion) ?? this._allApplications().find(isContentVersion);

    return contentApp?.pkg || null;
  });

  constructor() {
    effect(() => {
      const id = this.configurationDetailsFacadeService.configurationId();
      this.configurationDetailsFacadeService.reloadTrigger();

      if (id) {
        this.loadApplications(id);
      } else {
        this._applications.set([]);
      }
    });

    this.loadAllApplications();
  }

  setTableSearch(value: string): void {
    this.searchTerm.set(value);
  }

  loadApplications(configurationId: number): void {
    this.isLoadingApplications.set(true);
    this.versionsCache.clear();

    this.configurationService
      .getConfigurationApps(configurationId)
      .pipe(
        take(1),
        finalize(() => this.isLoadingApplications.set(false)),
      )
      .subscribe((apps) => {
        this._applications.set(apps);
      });
  }

  getActionOptions(app: TApplicationDTO): TOption<number>[] {
    const options: TOption<number>[] = [];

    if (this.isInstallOptionAvailable(app)) {
      options.push({
        value: APP_ACTION.ALLOW,
        viewValue: 'form.configuration.apps.action.install',
      });
      options.push({
        value: APP_ACTION.BLOCK,
        viewValue: 'form.configuration.apps.action.not.install',
      });
    } else {
      options.push({
        value: APP_ACTION.ALLOW,
        viewValue: 'form.configuration.apps.action.permit',
      });
      options.push({
        value: APP_ACTION.BLOCK,
        viewValue: 'form.configuration.apps.action.prohibit',
      });
    }

    if (this.isUninstallOptionAvailable(app)) {
      options.push({
        value: APP_ACTION.DELETE,
        viewValue: 'form.configuration.apps.action.delete',
      });
    }

    return options;
  }

  addApplication(app: TApplicationDTO): void {
    if (this.isInConfiguration(app.id)) {
      return;
    }

    this.configurationDetailsFacadeService.markUnsavedChanges();

    const currentApps = this._applications();
    this._applications.set([...currentApps, { ...app, actionChanged: true }]);
  }

  // True if the app is already in the configuration's list (the entries the list shows,
  // whatever the search text or the "Show preinstalled applications" switch)
  isInConfiguration(appId: number): boolean {
    return this._applications().some((app) => app.id === appId && this.isListed(app));
  }

  // Every entry with the package of the configuration's main app: duplicates and other versions too
  isMainApp(app: TApplicationDTO): boolean {
    const pkg = this.mainAppPkg();
    return !!pkg && app.pkg === pkg;
  }

  // Same for the configuration's content app
  isContentApp(app: TApplicationDTO): boolean {
    const pkg = this.contentAppPkg();
    return !!pkg && app.pkg === pkg;
  }

  // Message key explaining why the app's action and removal are locked, or null if they are not
  getUninstallLockMessage(app: TApplicationDTO): string | null {
    if (this.isMainApp(app)) {
      return 'form.configuration.apps.main.app.cannot.uninstall';
    }

    if (this.isContentApp(app)) {
      return 'form.configuration.apps.content.app.cannot.uninstall';
    }

    return null;
  }

  // Removes the clicked entry only (by object, not by id: duplicates share the id).
  // Stored when the configuration is saved; the main and content apps are never removed
  removeApplication(app: TApplicationDTO): void {
    if (this.isMainApp(app) || this.isContentApp(app)) {
      return;
    }

    this.configurationDetailsFacadeService.markUnsavedChanges();
    this._applications.update((apps) => apps.filter((a) => a !== app));
  }

  getApplicationById(id: number): TApplicationDTO | null {
    const app = this._allApplications().find((app) => app.id === id);
    return app || null;
  }

  setAppAction(app: TApplicationDTO, value: number): void {
    this.configurationDetailsFacadeService.markUnsavedChanges();

    this._applications.update((apps) =>
      apps.map((a) =>
        a.id === app.id && a.version === app.version
          ? { ...a, action: value, actionChanged: true }
          : a,
      ),
    );
  }

  setAppIcon(app: TApplicationDTO, value: boolean): void {
    this.configurationDetailsFacadeService.markUnsavedChanges();

    this._applications.update((apps) =>
      apps.map((a) =>
        a.id === app.id && a.version === app.version ? { ...a, showIcon: value } : a,
      ),
    );
  }

  setAppOrder(app: TApplicationDTO, value: number | null): void {
    this.configurationDetailsFacadeService.markUnsavedChanges();

    this._applications.update((apps) =>
      apps.map((a) =>
        a.id === app.id && a.version === app.version ? { ...a, screenOrder: value } : a,
      ),
    );
  }

  updateAppDetails(app: TApplicationDTO, value: TConfigurationAppDetailsFormValue): void {
    this.configurationDetailsFacadeService.markUnsavedChanges();

    this._applications.update((apps) =>
      apps.map((a) =>
        a.id === app.id && a.version === app.version
          ? {
              ...a,
              keyCode: toKeyCode(value.keyCode),
              bottom: value.bottom,
              longTap: value.longTap,
            }
          : a,
      ),
    );
  }

  // Versions the app's row can be switched to, newest first. A version with no file can't be
  // installed, and one that another row of the same app already uses would make two rows claim it
  getVersionOptions(app: TApplicationDTO): Observable<TVersionDTO[]> {
    const cached = this.versionsCache.get(app.id);
    const versions$ = cached
      ? of(cached)
      : this.applicationService
          .getVersionsByApplicationId(app.id)
          .pipe(tap((versions) => this.versionsCache.set(app.id, versions)));

    return versions$.pipe(
      map((versions) =>
        versions.filter(
          (version) =>
            (version.url || version.urlArmeabi || version.urlArm64) &&
            !this._applications().some(
              (a) =>
                a !== app && a.id === app.id && a.version === version.version && this.isListed(a),
            ),
        ),
      ),
    );
  }

  // Switches the clicked entry to another version of the same app. Stored when the configuration
  // is saved. The entry is matched by object: id and version are what this changes
  setAppVersion(app: TApplicationDTO, version: TVersionDTO): void {
    if (version.id === app.usedVersionId) {
      return;
    }

    this.configurationDetailsFacadeService.markUnsavedChanges();

    this._applications.update((apps) =>
      apps
        // The server also lists the latest version of every app outside the configuration;
        // drop that entry if it is the one picked, or it would share the row's id and version
        .filter((a) => a === app || !(a.id === app.id && a.version === version.version))
        .map((a) =>
          a === app
            ? {
                ...a,
                usedVersionId: version.id,
                version: version.version,
                versionCode: version.versionCode,
                url: version.url,
                urlArmeabi: version.urlArmeabi,
                urlArm64: version.urlArm64,
                split: version.split,
                outdated: version.id !== a.latestVersion,
              }
            : a,
        ),
    );
  }

  // "Upgrade" link of an outdated app: after confirmation the server switches the configuration
  // to the app's latest version at once (as in v5), then the configuration is reloaded.
  // Unsaved changes would be lost by that reload, so they have to be saved first
  upgradeApplication(app: TApplicationDTO): void {
    const configurationId = this.configurationDetailsFacadeService.configurationId();
    if (!configurationId) {
      return;
    }

    if (this.configurationDetailsFacadeService.hasUnsavedChanges()) {
      this.snackBarService.info('error.configuration.save.before.upgrade');
      return;
    }

    const configurationName =
      this.configurationDetailsFacadeService.currentConfiguration()?.name ?? '';

    this.dialog
      .open(ConfirmDialog, {
        data: {
          message: 'question.app.upgrade',
          params: { v1: app.name, v2: configurationName },
          confirmButtonText: 'button.upgrade',
        },
      })
      .afterClosed()
      .pipe(
        take(1),
        filter(Boolean),
        switchMap(() =>
          this.configurationService.upgradeConfigurationApplication(configurationId, app.id),
        ),
      )
      .subscribe((response) => {
        // Errors are shown by the response interceptor
        if (response.status === 'OK') {
          this.configurationDetailsFacadeService.setCurrentConfigurationId(configurationId);
        }
      });
  }

  setShowSystemApps(value: boolean): void {
    this.showSystemApps.set(value);
  }

  setSortState(state: TTableSortState | null): void {
    this._sortState.set(state);
  }

  // Entries with action 0 that were not changed here are apps outside the configuration:
  // the server sends every app, those come back with action 0 and are not shown
  private isListed(app: TApplicationDTO): boolean {
    return app.action !== APP_ACTION.BLOCK || !!app.actionChanged;
  }

  private isInstallOptionAvailable(app: TApplicationDTO): boolean {
    return !app.system && app.type === 'app' && !!(app.url || app.urlArm64 || app.urlArmeabi);
  }

  private isUninstallOptionAvailable(app: TApplicationDTO): boolean {
    return !app.system && app.type === 'app';
  }

  private loadAllApplications(): void {
    this.applicationService
      .search('')
      .pipe(take(1))
      .subscribe((apps) => {
        this._allApplications.set(apps);
      });
  }
}
