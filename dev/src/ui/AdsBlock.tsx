export function AdsBlock() {
    const url = new URL('../media/d26974c5-b1e9-48ad-b55f-88aab39ea114.png', import.meta.url);
    return (
        <div className="flex flex-col bg-black h-full w-full">
            <img className="bg-cover" src={url.toString()}></img>
            <a
                href="https://delt.io"
                className="border-blue-500 border-2 rounded px-3 py-1  self-center text-white my-auto text-2xl text-shadow-cyan-500 text-shadow-lg"
            >
                PLAY NOW
            </a>
        </div>
    );
}
