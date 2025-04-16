import { VNode } from 'preact';
import { MutableRef, useRef, useState } from 'preact/hooks';
import { JSXInternal } from 'preact/src/jsx';
import { Input, Option, Select, Slider } from '../../Settings.entities';
import { BasicSetting, Settings } from '../../Settngs';
import { camelCaseToWords } from '../../utils/utils';
import { useEventify } from './hooks';
type PickPropertyTypes<T, V> = {
    [K in keyof T as T[K] extends V ? K : never]: T[K];
};

function keepValue(a: KeyboardEvent) {
    const e = a as typeof e & { target: HTMLInputElement };
    if (e.keyCode === 27) {
        e.target.blur();
        e.preventDefault();
    }
}

export function UiOption<
    SettingType extends Option<boolean>,
    B extends { [x: string]: BasicSetting | SettingType },
    T extends Settings<B>,
    E extends Extract<keyof PickPropertyTypes<T['raw'], SettingType>, string>
>({ target, name }: { target: Settings<B>; name: E }) {
    const [value, updateValue] = useState(target.raw[name].value);
    // @ts-ignore
    useEventify((e) => e.listenTo(target, name, () => updateValue(target.raw[name].value))(), [name]);
    return (
        <UiOptionMarkup
            // @ts-ignore
            name={camelCaseToWords(target.raw[name].name || name)}
            value={value}
            onValue={(value) => {
                updateValue(value);
                target.proxy[name] = value;
            }}
        />
    );
}
interface OptionChildProps<T> {
    name: string | VNode;
    value: T;
    onValue: (arg: T) => void;
}
export function UiOptionMarkup({ name, value, onValue }: OptionChildProps<boolean>) {
    return (
        <label className="flex flex-row p-1 text-left gap-2">
            <div className="grow">{name}</div>
            <div className="">
                <label className="switch">
                    <input
                        name={Math.random().toString()}
                        className=""
                        onChange={(e) => onValue(e.target['checked'])}
                        checked={value}
                        defaultChecked={value}
                        type="checkbox"
                    />
                    <div className="slider round" data-on={'ui_on'} data-off={'ui_off'}></div>
                </label>
            </div>
        </label>
    );
}

export function UiSlider<
    SettingType extends Slider<number>,
    B extends { [x: string]: SettingType },
    T extends Settings<B>,
    E extends Extract<keyof PickPropertyTypes<T['raw'], SettingType>, string>
>({ target, name }: { target: Settings<B>; name: E }) {
    const helperRef = useRef<HTMLInputElement>();
    const unit = target.raw[name].unit || '';
    function updateValue(value: number) {
        helperRef.current.innerText = String(value.toFixed(target.raw[name].precision)) + unit;
    }
    useEventify(
        (e) => {
            // @ts-ignore
            e.listenTo(target, name, () => updateValue(target.raw[name].value))();
            return () => e.unlisten();
        },
        [name]
    );

    return (
        <SliderRender
            // @ts-ignore
            name={camelCaseToWords(name)}
            value={target.raw[name].value}
            data={target.raw[name]}
            onValue={(value: number) => {
                target.proxy[name] = value;
                updateValue(value);
            }}
            helperRef={helperRef}
        />
    );
}

export function SliderRender({
    name,
    value,
    data,
    onValue,
    helperRef
}: {
    name: VNode | string;
    value: number;
    data: { min: number; max: number; step: number };
    onValue: (arg: number) => void;
    helperRef: MutableRef<HTMLDivElement>;
}) {
    const rangeRef = useRef<HTMLInputElement>();

    return (
        <label class="flex p-1 text-left gap-2">
            <div class="grow">{name}</div>
            <div ref={helperRef} class="helper"></div>
            <div class="text-left">
                <input
                    name={Math.random().toString()}
                    ref={rangeRef}
                    class=""
                    type="range"
                    onInput={(e: InputEvent) => onValue(Number(e.target['value']))}
                    min={data.min}
                    max={data.max}
                    step={data.step}
                    value={value}
                    defaultValue={value.toString()}
                />
            </div>
        </label>
    );
}

export function UiSelectbox<
    SettingType extends Select<number>,
    B extends { [x: string]: SettingType },
    T extends Settings<B>,
    E extends Extract<keyof PickPropertyTypes<T['raw'], SettingType>, string>
>({ target, name }: { target: Settings<B>; name: E }) {
    const [value, updateValue] = useState(target.raw[name].value);
    useEventify(
        (e) => {
            const handleStatusChange = () => updateValue(target.raw[name].value);
            // @ts-ignore
            e.listenTo(target, name, handleStatusChange);
            handleStatusChange();
            return () => e.unlisten();
        },
        [name]
    );

    return (
        <SelectboxRender
            name={camelCaseToWords(name.toString())}
            value={value}
            data={target.raw[name].options}
            onValue={(value: number) => {
                // updateValue(value)
                target.proxy[name] = value;
            }}
        />
    );
}

export function SelectboxRender({
    name,
    value,
    data,
    onValue
}: {
    name: VNode | string;
    value: string | number;
    data: Record<string, string | number>;
    onValue: (arg: number | string) => void;
}) {
    return (
        <div className="flex p-1 text-left gap-2">
            <div className="grow">{name}</div>
            <div className="">
                <select
                    name={Math.random().toString()}
                    className="selectbox"
                    value={value}
                    onChange={(e: JSXInternal.TargetedEvent<HTMLSelectElement, Event & { target: HTMLSelectElement }>) =>
                        onValue(isNaN(e.target.value as unknown as number) ? e.target.value : Number(e.target.value))
                    }
                >
                    {Object.entries(data).map(([name, value]) => (
                        <option value={value}>{camelCaseToWords(name)}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

export function UiInputbox<
    SettingType extends Input<string>,
    B extends { [x: string]: SettingType },
    T extends Settings<B>,
    E extends Extract<keyof PickPropertyTypes<T['raw'], SettingType>, string>
>({ target, name }: { target: Settings<B>; name: E }) {
    function onValue(value: string) {
        // const { target, name } = this.props;
        target.proxy[name] = value;
    }
    const [value, updateValue] = useState(target.raw[name].value);
    useEventify(
        (e) => {
            const handleStatusChange = () => updateValue(target.raw[name].value);
            // @ts-ignore
            e.listenTo(target, name, handleStatusChange);
            handleStatusChange();
            return () => e.unlisten();
        },
        [name]
    );

    const display_name = camelCaseToWords(name as string);
    return (
        <div class="flex p-1 text-left gap-2">
            <div class="grow">{display_name}</div>
            <div class="flex grow" style={{ width: '30%' }}>
                <input
                    name={Math.random().toString()}
                    class="input"
                    type="search"
                    inputMode="text"
                    autocomplete="off"
                    style="width: 100%;"
                    placeholder={name.toString()}
                    onKeyDown={keepValue}
                    onInput={(e: InputEvent) => onValue(e.target['value'])}
                    value={value}
                    defaultValue={value}
                />
                {true ? (
                    <select
                        name={'select-' + Math.random()}
                        class="w-4"
                        onChange={(_e) => {
                            const e = _e as unknown as Event & { target: HTMLInputElement };
                            e.target.value != undefined && onValue(e.target.value);
                            e.target.value = '';
                            e.target.blur();
                        }}
                        style=""
                    >
                        <option value=""></option>
                        {typeof target.raw[name].default !== 'undefined' && <option value={target.raw[name].default}>Default</option>}

                        {Object.entries(target.raw[name].options)?.map(([key, val]) => <option value={val}>{key}</option>)}
                    </select>
                ) : null}
            </div>
        </div>
    );
}
