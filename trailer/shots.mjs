export const FPS = 60;
export const SHOTS = [
	{ id: 'bench', dur: 1, warm: 20,
		setup: (w) => { w.sky.state.hours = 17.6; w.weather.set('fair'); const B = w.bridge; return { B: [B.centre.x, B.centre.z], info: 'bridge ' + B.centre.x.toFixed(0) + ',' + B.centre.z.toFixed(0) }; },
		cam: (S, w, C) => { const [x, z] = C.LL(37.8322, -122.4808); const g = C.ground(x, z); return [{ t: 0, p: [x, g + 40, z], l: [S.B[0], 80, S.B[1]], fov: 45 }, { t: 1, p: [x + 10, g + 42, z], l: [S.B[0], 80, S.B[1]] }]; } },
];
