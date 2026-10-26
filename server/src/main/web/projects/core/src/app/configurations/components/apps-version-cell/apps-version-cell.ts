import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { take } from 'rxjs';
import { BaseCellRenderer, TranslatePipe } from 'hmdm-ui-kit';
import { TApplicationDTO } from '../../../entity/application/types/application-dto.type';
import { TVersionDTO } from '../../../entity/application/types/version-dto.type';
import { APP_ACTION } from '../../const/app-action.const';
import { ConfigurationAppsFacadeService } from '../../services/configuration-applications-facade.service';

// Version of an app in the configuration's list, with an "Upgrade" link (as in v5) when a newer
// version has been uploaded and the app is set to be installed. Clicking the version opens a menu
// of the app's other versions
@Component({
  selector: 'core-apps-version-cell',
  templateUrl: './apps-version-cell.html',
  styleUrl: './apps-version-cell.scss',
  imports: [
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
})
export class AppsVersionCell extends BaseCellRenderer<TApplicationDTO> {
  private readonly configurationAppsFacadeService = inject(ConfigurationAppsFacadeService);

  // Null while loading
  versions: WritableSignal<TVersionDTO[] | null> = signal(null);

  canUpgrade: Signal<boolean> = computed(() => {
    const app = this.params().data;
    return !!app?.outdated && app.action === APP_ACTION.ALLOW;
  });

  // Not for system apps, which have no versions of their own, nor for the main and content apps:
  // the configuration refers to those by version id
  canChangeVersion: Signal<boolean> = computed(() => {
    const app = this.params().data;
    return (
      !!app &&
      !app.system &&
      app.type === 'app' &&
      !this.configurationAppsFacadeService.getUninstallLockMessage(app)
    );
  });

  loadVersions(): void {
    this.versions.set(null);
    this.configurationAppsFacadeService
      .getVersionOptions(this.params().data)
      .pipe(take(1))
      .subscribe((versions) => this.versions.set(versions));
  }

  onVersionClick(version: TVersionDTO): void {
    this.configurationAppsFacadeService.setAppVersion(this.params().data, version);
  }

  onUpgradeClick(): void {
    this.configurationAppsFacadeService.upgradeApplication(this.params().data);
  }
}
