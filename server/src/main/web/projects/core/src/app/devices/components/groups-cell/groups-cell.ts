import { Component, computed, Signal } from '@angular/core';
import { BaseCellRenderer } from 'hmdm-ui-kit';
import { TDevice } from '../../types/device.type';

@Component({
  selector: 'core-groups-cell',
  templateUrl: './groups-cell.html',
})
export class GroupsCell extends BaseCellRenderer<TDevice, null> {
  groupNames: Signal<string> = computed(
    () =>
      this.params()
        .data?.groups?.map((group) => group.name)
        .join(', ') ?? '',
  );
}
