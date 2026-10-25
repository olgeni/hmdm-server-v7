import { inject, Injectable } from '@angular/core';
import {
  BooleanCell,
  DatetimeCell,
  EStatusColor,
  StatusCellRenderer,
  TStatus,
  TStatusCellParams,
  TStatusColor,
  TTableConfig,
} from 'hmdm-ui-kit';
import { TranslateService } from '@ngx-translate/core';
import { TColumnConfig } from '../../../../../hmdm-ui-kit/src/lib/table/types/column-config.type';
import { SettingsFacadeService } from '../../shared/services/settings-facade.service';
import { ActionsCell } from '../components/actions-cell/actions-cell';
import { ConfigurationCell } from '../components/configuration-cell/configuration-cell';
import { GroupsCell } from '../components/groups-cell/groups-cell';
import { STATUS_MAPPER } from '../const/status-mapper';
import { DevicesFacadeService } from '../services/devices-facade.service';
import { TDevice } from '../types/device.type';
import { DEVICE_COLUMNS_DISPLAY } from '../const/device-columns-display.const';

@Injectable({
  providedIn: 'root',
})
export class DeviceTableConfig {
  private readonly settingsFacadeService = inject(SettingsFacadeService);
  private readonly devicesFacadeService = inject(DevicesFacadeService);
  private readonly translateService = inject(TranslateService);

  getConfig(): TTableConfig {
    const columns = {
      columns: [
        {
          field: 'statusCode',
          title: 'table.heading.device.status',
          cellRenderer: StatusCellRenderer,
          cellRendererParams: this.getStatusParams(),
        },
        {
          field: 'lastUpdate',
          title: 'table.heading.device.date',
          cellRenderer: DatetimeCell,
          sortable: true,
        },
        {
          field: 'number',
          title: 'table.heading.device.device.number',
          sortable: true,
        },
        {
          field: 'imei',
          title: 'table.heading.device.imei',
          sortable: true,
        },
        {
          field: 'phone',
          title: 'table.heading.device.phone.number',
          sortable: true,
        },
        {
          field: 'info.model',
          title: 'form.settings.common.phone.model',
          sortable: true,
        },
        {
          field: 'permissionStatus',
          title: 'table.heading.device.status.permissions',
          sortable: true,
          cellRenderer: StatusCellRenderer,
          cellRendererParams: this.getPermissionStatusParams(),
        },
        {
          field: 'installationStatus',
          title: 'table.heading.device.status.installation',
          sortable: true,
          cellRenderer: StatusCellRenderer,
          cellRendererParams: this.getInstallationStatusParams(),
        },
        {
          field: 'filesStatus',
          title: 'table.heading.device.status.files',
          sortable: true,
          cellRenderer: StatusCellRenderer,
          cellRendererParams: this.getFilesStatusParams(),
        },
        {
          field: 'configurationId',
          title: 'table.heading.device.configuration',
          cellRenderer: ConfigurationCell,
          sortable: true,
        },
        {
          field: 'description',
          title: 'table.heading.device.desc',
          sortable: true,
        },
        {
          field: 'group',
          title: 'table.heading.device.group',
          cellRenderer: GroupsCell,
        },
        {
          field: 'launcherVersion',
          title: 'table.heading.device.launcher.version',
          sortable: true,
        },
        {
          field: 'info.batteryLevel',
          title: 'table.heading.device.battery.level',
          sortable: true,
        },
        {
          field: 'mdmMode',
          title: 'table.heading.device.mdm.mode',
          cellRenderer: BooleanCell,
          sortable: true,
        },
        {
          field: 'info.defaultLauncher',
          title: 'table.heading.device.default.launcher',
          cellRenderer: BooleanCell,
          sortable: true,
        },
        {
          field: 'info.kioskMode',
          title: 'table.heading.device.kiosk.mode',
          cellRenderer: BooleanCell,
          sortable: true,
        },
        {
          field: 'androidVersion',
          title: 'table.heading.device.android.version',
          sortable: true,
        },
        {
          field: 'enrollTime',
          title: 'table.heading.device.enrollment.date',
          cellRenderer: DatetimeCell,
          sortable: true,
        },
        {
          field: 'serial',
          title: 'table.heading.device.serial',
          sortable: true,
        },
        {
          field: 'publicIp',
          title: 'table.heading.device.publicip',
          sortable: true,
        },
        ...this.getCustomColumns(),
        {
          title: 'table.heading.device.actions',
          stickyEnd: true,
          width: '160px',
          cellRenderer: ActionsCell,
        },
      ],
      paginator: {
        pageSizeOptions: [10, 20, 50],
        pageSize: 50,
      },
      selector: true,
      trackBy: 'id',
    };

    return this.filterDisplayedColumns(columns);
  }

  private filterDisplayedColumns(columns: any) {
    const config = DEVICE_COLUMNS_DISPLAY;

    const displayedColumns = config
      .map((item) => {
        const settings = this.devicesFacadeService.deviceSettings();
        if (settings && settings[item.condition]) {
          return item.column;
        }
        return null;
      })
      .filter((col): col is string => col !== null);

    return {
      ...columns,
      columns: columns.columns.filter((col: TColumnConfig<TDevice>) => {
        if (col.field) {
          return displayedColumns.includes(col.field) || !col.field;
        } else {
          return true;
        }
      }),
    };
  }

  private getCustomColumns(): TColumnConfig<TDevice>[] {
    const columns: TColumnConfig<TDevice>[] = [];
    const settings = this.settingsFacadeService.settings();

    if (!settings) {
      return [];
    }

    if (settings.customPropertyName1) {
      columns.push({
        field: 'custom1',
        title: settings.customPropertyName1,
      });
    }

    if (settings.customPropertyName2) {
      columns.push({
        field: 'custom2',
        title: settings.customPropertyName2,
      });
    }

    if (settings.customPropertyName3) {
      columns.push({
        field: 'custom3',
        title: settings.customPropertyName3,
      });
    }

    return columns;
  }

  private getStatusParams(): TStatusCellParams<TDevice> {
    return {
      status: (data: TDevice): TStatus => {
        const tooltip = this.calculateStatusTooltip(data.lastUpdate);
        return { ...(STATUS_MAPPER[data.statusCode] || { color: 'gray' }), tooltip };
      },
    };
  }

  private calculateStatusTooltip(lastUpdate: number): string {
    if (!lastUpdate) {
      return this.translateService.instant('devices.date.unknown');
    }

    const offlineDelay = (Date.now() - lastUpdate) / 60000;
    let res: string;

    if (offlineDelay < 60) {
      res =
        Math.round(offlineDelay) +
        ' ' +
        this.translateService.instant('form.devices.status.minutes');
    } else if (offlineDelay < 1440) {
      res =
        Math.round(offlineDelay / 60) +
        ' ' +
        this.translateService.instant('form.devices.status.hours');
    } else if (offlineDelay < 10080) {
      res =
        Math.round(offlineDelay / 1440) +
        ' ' +
        this.translateService.instant('form.devices.status.days');
    } else if (offlineDelay < 43200) {
      res =
        Math.round(offlineDelay / 10080) +
        ' ' +
        this.translateService.instant('form.devices.status.weeks');
    } else if (offlineDelay < 525600) {
      res =
        Math.round(offlineDelay / 43200) +
        ' ' +
        this.translateService.instant('form.devices.status.months');
    } else {
      res =
        Math.round(offlineDelay / 525600) +
        ' ' +
        this.translateService.instant('form.devices.status.years');
    }

    const date = new Date(lastUpdate);
    const formatted = date.toLocaleString('sv').replace('T', ' '); // yyyy-MM-dd HH:mm:ss
    return res + ' ' + this.translateService.instant('form.devices.status.ago') + '\n' + formatted;
  }

  private getPermissionStatusParams(): TStatusCellParams<TDevice> {
    return {
      status: (data: TDevice): TStatus => {
        if (!data.info?.permissions) {
          return this.getStatusRed(this.translateService.instant('devices.unknown'));
        }

        if (data.info.kioskMode) {
          return this.getStatusGreen(this.translateService.instant('devices.permissions.all'));
        }

        const sum = data.info.permissions.reduce((acc, perm) => acc + perm, 0);

        if (sum === 3) {
          return this.getStatusGreen(this.translateService.instant('devices.permissions.all'));
        }

        const missingLines: string[] = [];
        if (data.info.permissions[0] !== 1) {
          missingLines.push(
            this.translateService.instant('devices.permissions.not.as.device.admin'),
          );
        }
        if (data.info.permissions[1] !== 1) {
          missingLines.push(
            this.translateService.instant('devices.permissions.window.overlap.prohibited'),
          );
        }
        if (data.info.permissions[2] !== 1) {
          missingLines.push(
            this.translateService.instant('devices.permissions.history.access.prohibited'),
          );
        }

        const tooltip = missingLines.join('\n');
        return sum === 0 ? this.getStatusRed(tooltip) : this.getStatusYellow(tooltip);
      },
    };
  }

  private getInstallationStatusParams(): TStatusCellParams<TDevice> {
    return {
      status: (data: TDevice): TStatus => {
        const applications = this.getDeviceAppsStatus(data);

        if (!applications) {
          return this.getStatusRed(this.translateService.instant('devices.unknown'));
        }

        let correctCount = 0;
        let incorrectCount = 0;
        let notInstalledCount = 0;
        let removedCount = 0;
        let length = 0;
        const tooltipLines: string[] = [];

        for (const app of applications) {
          if (app.status !== undefined) {
            length++;
            if (app.status === 2) {
              incorrectCount++;
              tooltipLines.push(
                this.translateService.instant('devices.app.installed.and.version.available', {
                  applicationName: app.name,
                  applicationInstalledVersion: app.installedVersion,
                  applicationVersionAvailable: app.version,
                }),
              );
            }
            if (app.status === 3) {
              correctCount++;
            }
            if (app.status === 1) {
              notInstalledCount++;
              let line = this.translateService.instant('devices.app.not.installed', {
                applicationName: app.name,
              });
              if (app.version !== '0') {
                line += this.translateService.instant('devices.app.version.available', {
                  applicationVersion: app.version,
                });
              }
              tooltipLines.push(line);
            }
            if (app.status === 4) {
              removedCount++;
              tooltipLines.push(
                this.translateService.instant('devices.app.installed', {
                  applicationName: app.name,
                }) +
                  this.translateService.instant('devices.app.needs.removal', {
                    applicationVersion: app.installedVersion ? ' ' + app.installedVersion : '',
                  }),
              );
            }
          }
        }

        const tooltip = tooltipLines.join('\n');

        if (correctCount === length) {
          return this.getStatusGreen(this.translateService.instant('devices.permissions.all'));
        } else if (notInstalledCount > 0) {
          return this.getStatusRed(tooltip);
        } else {
          return this.getStatusYellow(tooltip);
        }
      },
    };
  }

  private getDeviceAppsStatus(device: TDevice): any {
    if (!device.info) {
      return null;
    }

    const configApplications = device.configuration?.applications;
    if (!configApplications) {
      return null;
    }

    const deviceApplications = device.info.applications || [];

    return configApplications.map((configApp) => {
      // Applications without URL are system apps and they are not checked
      if (!configApp.selected || !configApp.url) {
        return configApp;
      }

      let status = 3; // Good
      let installedVersion: string | undefined;

      const deviceApp = deviceApplications.find((app) => app.pkg === configApp.pkg);

      if (deviceApp) {
        if (configApp.action === 2) {
          if (configApp.version === deviceApp.version) {
            installedVersion = deviceApp.version;
            status = 4; // Needs to be removed
          }
        } else if (
          configApp.version !== '0' &&
          !configApp.skipVersion &&
          !this.isVersionUpToDate(deviceApp.version, configApp.version)
        ) {
          installedVersion = deviceApp.version;
          status = 2; // Version mismatch
        }
      } else if (configApp.action !== 2) {
        status = 1; // Not installed
      }

      return {
        ...configApp,
        status,
        ...(installedVersion && { installedVersion }),
      };
    });
  }

  private isVersionUpToDate(installedVersion: string, requiredVersion: string): boolean {
    // Versions are numbers separated by a dot
    const v1d = (installedVersion || '').replace(/[^\d.]/g, '');
    const v2d = (requiredVersion || '').replace(/[^\d.]/g, '');

    const v1n = v1d.split('.');
    const v2n = v2d.split('.');

    // One version could contain more digits than another
    const count = v1n.length < v2n.length ? v1n.length : v2n.length;

    for (let n = 0; n < count; n++) {
      const n1 = Number(v1n[n]);
      const n2 = Number(v2n[n]);
      if (n1 < n2) {
        return false;
      } else if (n1 > n2) {
        return true;
      }
      // If major version numbers are equal, continue to compare minor version numbers
    }

    // Here we are if common parts are equal
    // Now we decide that if a version has more parts, it is considered as greater
    if (v1n.length < v2n.length) {
      return false;
    } else if (v1n.length > v2n.length) {
      return true;
    }

    return true;
  }

  private getDeviceFilesStatus(device: TDevice): any[] | null {
    const info = device.info;
    if (!info || !device.configuration?.files) {
      return null;
    }

    const configFiles: any[] = device.configuration.files.map((configFile) =>
      configFile.path ? { ...configFile, status: 3 } : configFile,
    );
    const deviceFiles = info.files || [];

    for (const configFile of configFiles.filter((f: any) => f.path)) {
      let foundOnDevice = false;
      for (const deviceFile of deviceFiles) {
        if (deviceFile.path === configFile.path) {
          foundOnDevice = true;
          if (
            configFile.lastUpdate !== deviceFile.lastUpdate &&
            Math.abs(configFile.lastUpdate - deviceFile.lastUpdate) > 1 * 60 * 60 * 1000
          ) {
            configFile.status = 2; // lastUpdate mismatches
            configFile.lastUpdateDiff = Math.abs(configFile.lastUpdate - deviceFile.lastUpdate);
          }
          break;
        }
      }
      if (!foundOnDevice && configFile.remove === false) {
        configFile.status = 1; // Not installed
      }
    }

    return configFiles;
  }

  private getFilesStatusParams(): TStatusCellParams<TDevice> {
    return {
      status: (data: TDevice): TStatus => {
        const files = this.getDeviceFilesStatus(data);
        if (!files) {
          return this.getStatusRed(this.translateService.instant('devices.unknown'));
        }

        let correctCount = 0;
        let incorrectCount = 0;
        let notInstalledCount = 0;
        let removedCount = 0;
        let length = 0;
        const tooltipLines: string[] = [];

        for (const file of files) {
          if (file.status !== undefined) {
            length++;
            if (file.status === 2) {
              incorrectCount++;
              const diffMinutes = Math.round((file.lastUpdateDiff || 0) / 60000);
              tooltipLines.push(
                this.translateService.instant('devices.file.lastUpdate.differs', {
                  file: file.path,
                  diff: diffMinutes,
                }),
              );
            }
            if (file.status === 3) {
              correctCount++;
            }
            if (file.status === 1) {
              notInstalledCount++;
              tooltipLines.push(
                this.translateService.instant('devices.file.not.installed', { file: file.path }),
              );
            }
            if (file.status === 4) {
              removedCount++;
            }
          }
        }

        const tooltip = tooltipLines.join('\n');

        if (correctCount === length) {
          return this.getStatusGreen(this.translateService.instant('devices.permissions.all'));
        } else if (notInstalledCount > 0) {
          return this.getStatusRed(tooltip);
        } else {
          return this.getStatusYellow(tooltip);
        }
      },
    };
  }

  private getStatus(color: TStatusColor, tooltip: string): TStatus {
    return { color, tooltip };
  }

  getStatusRed(tooltip: string): TStatus {
    return this.getStatus(EStatusColor.RED, tooltip);
  }

  getStatusGreen(tooltip: string): TStatus {
    return this.getStatus(EStatusColor.GREEN, tooltip);
  }

  getStatusYellow(tooltip: string): TStatus {
    return this.getStatus(EStatusColor.YELLOW, tooltip);
  }
}
