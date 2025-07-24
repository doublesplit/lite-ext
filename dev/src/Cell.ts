export class Cell {
    static size2squared(cell_size: number): number {
        return cell_size * cell_size;
    }
    static squared2size(squared_size: number): number {
        return Math.sqrt(squared_size);
    }
    static size2mass(cell_size: number): number {
        return (cell_size * cell_size) / 100;
    }
    static mass2size(cell_mass: number): number {
        return Math.sqrt(100 * cell_mass);
    }
    id: number;
    colorInt: number;
    accountID: number | null = null;

    targetX: number;
    targetY: number;
    targetSize: number;
    name: string | null = null;

    construct(id: number, colorInt: number, accountID: number | null) {
        this.id = id;
        this.colorInt = colorInt;
        this.accountID = accountID;
    }
    setTarget(x: number, y: number, size: number) {
        this.targetX = x;
        this.targetY = y;
        this.targetSize = size;
    }
    setName(name: string) {
        if (name) this.name = name;
    }
}
