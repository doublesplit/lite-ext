import { BasicSetting, Settings } from '../Settngs';
import { UiInputbox, UiOption, UiSelectbox, UiSlider } from './componetns/Inputs';

type SettingsListParams = {
    array: Array<[string, BasicSetting]>;
    target: Settings<Record<string, BasicSetting>>;
};
export function SettingsList({ array, target }: SettingsListParams) {
    // @ts-ignore
    const result = array.map(([optName, setting]) => {
        const type = setting.type;

        // @ts-ignore
        if (type == 'OPT') return <UiOption target={target} name={optName} />;
        // @ts-ignore
        if (type == 'SLD') return <UiSlider target={target} name={optName} />;
        // @ts-ignore
        if (type == 'SEL') return <UiSelectbox target={target} name={optName} />;
        // @ts-ignore
        if (type == 'INP') return <UiInputbox target={target} name={optName} />;
        // @ts-ignore
        if (type == 'COL') return <UiColorbox target={target} name={optName} />;
    });
    return result;
}
