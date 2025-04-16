export const timelord = (function () {
    /*
		# Time accounted for
			Date.now()
			window.performance.now()
			window.setInterval(...)
			window.setTimeout(...)
			window.requestAnimationFrame(...)
		# Not accounted for
			(new Date()).getTime()
	*/

    let fakeTime_ms = 0;
    let fakeTime_ms2 = 0;
    let activateStamp = 0;

    let intervalIdCounter = 1;
    const intervals = [];

    function stepTime(dt_ms, dt_ms2) {
        fakeTime_ms += dt_ms;
        fakeTime_ms2 += dt_ms2;

        let i = intervals.length;
        while (--i >= 0) {
            const iObj = intervals[i];
            const dt = fakeTime_ms2 - iObj.start_ms;

            if (dt >= iObj.ms) {
                //fire
                iObj.fn.apply(window, iObj.fnArgs);

                if (iObj.loop) {
                    iObj.start_ms += iObj.ms;
                } else {
                    //remove
                    intervals.splice(i, 1);
                }
            }
        }
    }

    // function setTime(ms){
    // 	if(ms < fakeTime_ms){
    // 		console.warn('TimeLord: without a tardis or flux capacitor you\'re probably going to have errors if you try to go back in time');
    // 	}
    // 	var dt_ms = ms - fakeTime_ms;
    // 	stepFakeTime(dt_ms, dt_ms);//call stepTime so our intervals get fired
    // }

    function getTime() {
        return fakeTime_ms;
    }

    function addInterval(fn, ms, loop, fnArgs) {
        const id = intervalIdCounter++;
        intervals.push({
            id: id,
            fn: fn,
            ms: ms,
            loop: loop,
            fnArgs: fnArgs,
            start_ms: fakeTime_ms2
        });
        return id;
    }

    function removeInterval(id) {
        let i = intervals.length;
        while (--i >= 0) {
            if (intervals[i].id === id) {
                intervals.splice(i, 1);
                break;
            }
        }
    }

    function activate() {
        //override javascript time functions
        activateStamp = Date.now();

        // absolute time
        Date['_now'] = Date.now;
        Date.now = function () {
            return activateStamp + fakeTime_ms2;
        };

        window.performance['_now'] = window.performance.now;
        window.performance.now = function () {
            return fakeTime_ms;
        };

        // relative time
        // window['_setTimeout'] = window.setTimeout;
        // window.setTimeout = function(fn, ms){
        // 	var fnArgs = Array.prototype.slice.call(arguments, [2]);
        // 	return addInterval(fn, ms, false, fnArgs);
        // }

        // window['_setInterval'] = window.setInterval;
        // window.setInterval = function(fn, ms){
        // 	var fnArgs = Array.prototype.slice.call(arguments, [2]);
        // 	return addInterval(fn, ms, true, fnArgs);
        // }

        // window['_clearInterval'] = window.clearInterval;
        // window.clearInterval = function(id){
        // 	removeInterval(id);
        // }

        // window['_clearTimeout'] = window.clearTimeout;
        // window.clearTimeout = function(id){
        // 	removeInterval(id);
        // }

        window['_requestAnimationFrame'] = window.requestAnimationFrame;
        window.requestAnimationFrame = function (cb) {
            const newCb = function (realTime_ms) {
                return cb(fakeTime_ms);
            };
            return window['_requestAnimationFrame'](newCb);
        };
    }

    return {
        activate: activate,
        stepTime: stepTime,
        // setTime: setTime,
        getTime: getTime
    };
})();
