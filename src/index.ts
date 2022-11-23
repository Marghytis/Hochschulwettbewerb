import * as PIXI from 'pixi.js'

// Constants
let N_nuclei_start = 100;
let N_protons_start = 100;
let N_neutrons_start = 100;

// Create application
const app = new PIXI.Application({
	view: document.getElementById("pixi-canvas") as HTMLCanvasElement,
	resolution: window.devicePixelRatio || 1,
	autoDensity: true,
	backgroundColor: 0x6495ed,
	width: (window.innerWidth > 0) ? window.innerWidth : screen.width,
	height: (window.innerHeight > 0) ? window.innerHeight : screen.height
});

// Load resources, afterwards call setup()
PIXI.Loader.shared
	.add("Spritesheet.json")
	.add("bound_electron_shader.frag")
	.load(setup);

// In the mean time, do as much as possible before setup is called

// Create the renderTexture (i.e. Framebuffer) for the bound electrons
const electron_renderTexture = PIXI.RenderTexture.create({ width: app.screen.width, height: app.screen.height });
// Make sprite for bound electrons that contains the renderTexture
let bound_electron_sprite = new PIXI.Sprite(electron_renderTexture);
app.stage.addChild(bound_electron_sprite);

// Declare stuff
let offset = {x: 0, y: 0};
var electron_shader: PIXI.Filter;
var electron_canvas: PIXI.Sprite;
var h3_animation: PIXI.Texture<PIXI.Resource>[];
var neutron_texture: PIXI.Texture<PIXI.Resource>;
var proton_texture: PIXI.Texture<PIXI.Resource>;

let nuclei: Nucleus[] = [];
let pos = new Float32Array(1000*2);

let neutrons: Neutron[] = [];
let protons: Proton[] = [];

let nucleon_container = new PIXI.Container();
let neutron_container = new PIXI.ParticleContainer(1000);
let proton_container = new PIXI.ParticleContainer(1000);

app.stage.addChild(nucleon_container, neutron_container, proton_container);

let wKey = keyboard("KeyW");
let aKey = keyboard("KeyA");
let sKey = keyboard("KeyS");
let dKey = keyboard("KeyD");

let debug_text = new PIXI.Text("fgsdfgdfg");
debug_text.x = 100;
debug_text.y = 100;
app.stage.addChild(debug_text);

function setup() {

	// Make electron shader
	let fragment_shader = PIXI.Loader.shared.resources["bound_electron_shader.frag"].data;
	electron_shader = new PIXI.Filter('',fragment_shader, {time: 1.0, pos: {x:100.0, y:100.0}, nElectrons: 4, nNuclei: 0});

	// Make dummy electron rectangle that will be drawn with the electron_shader
	electron_canvas = PIXI.Sprite.from(PIXI.Texture.WHITE);
	electron_canvas.width = app.screen.width;
	electron_canvas.height = app.screen.height;
	electron_canvas.tint = 0xFFFFFF;
	electron_canvas.filters = [electron_shader];

	 // Make
	let sheet = PIXI.Loader.shared.resources["Spritesheet.json"];
	if (sheet?.textures) {
		neutron_texture = sheet.textures["Proton.png"];
		proton_texture = sheet.textures["Neutron.png"];
	}
	if (sheet.spritesheet) {
		h3_animation = sheet.spritesheet.animations["H3"];
	}
	app.stage.interactive = true;
	app.stage.hitArea = app.screen;
	app.stage.on('pointerup', onDragEnd);
	app.stage.on('pointerupoutside', onDragEnd);
	app.stage.on("pointerdown", onDragStart)
	init();
	app.ticker.add(delta => gameLoop(delta)).add(renderTextures);
}

let dragging = false;
let lastPosition = {x:0,y:0};
let decay_rate: number;

function onDragStart(event: PIXI.InteractionEvent) {
	dragging = true;
	lastPosition.x = event.data.global.x;
	lastPosition.y = event.data.global.y;
	app.stage.on("pointermove", onDragMove);
	// console.log("start", event.data.global);
}

function onDragMove(event: PIXI.InteractionEvent) {

	if(dragging) {
		let shift_x = event.data.global.x - lastPosition.x;
		let shift_y = event.data.global.y - lastPosition.y;
		offset.x += shift_x;
		offset.y += shift_y;
		lastPosition.x = event.data.global.x;
		lastPosition.y = event.data.global.y;
		console.log("move", shift_x);
	}
}

function onDragEnd() {
	if (dragging) {
		dragging = false;
        app.stage.off('pointermove', onDragMove);
		// console.log("end");
    }
}

class Neutron extends PIXI.Sprite {
	vx: number;
	vy: number;
	bound?: Proton = undefined;
	energy_stored: number = 0;
	constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
		super(neutron_texture);
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
	}
}

class Proton extends PIXI.Sprite {
	vx: number;
	vy: number;
	bound?: Neutron = undefined;
	constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
		super(proton_texture);
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
	}
}

class Nucleus extends PIXI.AnimatedSprite {
	vx: number;
	vy: number;
	constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
		super(h3_animation);
		this.x = x;
		this.y = y;
		this.vx = vx;
		this.vy = vy;
		this.animationSpeed = 0.1;
		this.play();
	}
}

function addNeutron(particle: Neutron) {
	// Only call if setup is done
	neutron_container.addChild(particle);
	neutrons.push(particle);
}

function addProton(particle: Proton) {
	// Only call if setup is done
	proton_container.addChild(particle);
	protons.push(particle);
}

function newNucleus(x: number, y: number, vx: number = 0, vy: number = 0) {
	// Only call if setup is done
	let animatedH3 = new Nucleus(x, y, vx, vy);
	nucleon_container.addChild(animatedH3);
	nuclei.push(animatedH3);
}
let off_screen_gap = 100;
let density :number;

let dist_coll = 25;
let v_mean:number;

function init() {
	for(let i = 0; i < N_nuclei_start; i++) {
		newNucleus(
			Math.random()*app.screen.width,
			Math.random()*app.screen.height,
			2*Math.random() - 1,
			2*Math.random() - 1);
	}
	for(let i = 0; i < N_neutrons_start; i++) {
		addNeutron(new Neutron(
			Math.random()*app.screen.width,
			Math.random()*app.screen.height,
			2*Math.random() - 1,
			2*Math.random() - 1)
		);
	}
	for(let i = 0; i < N_protons_start; i++) {
		addProton(new Proton(
			Math.random()*app.screen.width,
			Math.random()*app.screen.height,
			2*Math.random() - 1,
			2*Math.random() - 1)
		);
	}
	density = (N_protons_start + N_neutrons_start)/(2*(app.screen.width + 2*off_screen_gap)*(app.screen.height + 2*off_screen_gap));
	let v_sum =0;
	for (let i =0 ; i < neutrons.length; i++) {
		v_sum += Math.sqrt(neutrons[i].vx*neutrons[i].vx + neutrons[i].vy*neutrons[i].vy);
	}
	v_mean = v_sum/neutrons.length;
	v_mean = 1;

	// lambda = 1/(density*sigma)
	// 
	// dN/dt = -alpha*N + 2*density*v_mean*dist_coll*N_protons = 0   | m^-2 m/s m = 1/s
	// alpha = 2*density*v_mean*dist_coll*N_protons/N
	// dN_n/dt = +alpha*N 
	// => N(t) = exp(-alpha*t)//ß.002

	decay_rate = 2*density*v_mean*dist_coll*(N_neutrons_start + N_protons_start)/(2*N_nuclei_start);
}

function renderTextures(delta: number) {
	// Render bound electrons
	electron_shader.uniforms.time = electron_shader.uniforms.time + 0.1*delta; 
	for(let i = 0; i < nuclei.length; i++) {
		pos[2*i] = nuclei[i].x + nuclei[i].width/2;
		pos[2*i + 1] = nuclei[i].y + nuclei[i].height/2;
	}
	electron_shader.uniforms.pos = pos;
	electron_shader.uniforms.nNuclei = nuclei.length;
	app.renderer.render(electron_canvas, {renderTexture: electron_renderTexture});
}

function gameLoop(delta : number) {
	if(offset.x != 0) {
		console.log(offset);
	}
	if(wKey.isDown) offset.y += delta*10;
	if(aKey.isDown) offset.x += delta*10;
	if(sKey.isDown) offset.y -= delta*10;
	if(dKey.isDown) offset.x -= delta*10;
	
	let width_with_gap = app.screen.width + 2*off_screen_gap;
	let height_with_gap = app.screen.height + 2*off_screen_gap;
	for(let i = 0; i < nuclei.length; i++) {
		nuclei[i].x = nuclei[i].x + nuclei[i].vx*delta + offset.x;
		nuclei[i].y = nuclei[i].y + nuclei[i].vy*delta + offset.y;
		nuclei[i].x = nuclei[i].x - Math.floor((nuclei[i].x + off_screen_gap)/width_with_gap)*width_with_gap;
		nuclei[i].y = nuclei[i].y - Math.floor((nuclei[i].y + off_screen_gap)/height_with_gap)*height_with_gap;
	}
	for(let i = 0; i < neutrons.length; i++) {
		if(!neutrons[i].bound) {
			neutrons[i].x = neutrons[i].x + neutrons[i].vx*delta + offset.x;
			neutrons[i].y = neutrons[i].y + neutrons[i].vy*delta + offset.y;
			neutrons[i].x = neutrons[i].x - Math.floor((neutrons[i].x + off_screen_gap)/width_with_gap)*width_with_gap;
			neutrons[i].y = neutrons[i].y - Math.floor((neutrons[i].y + off_screen_gap)/height_with_gap)*height_with_gap;
		}
	}
	for(let i = 0; i < protons.length; i++) {
		if(!protons[i].bound) {
			protons[i].x = protons[i].x + protons[i].vx*delta + offset.x;
			protons[i].y = protons[i].y + protons[i].vy*delta + offset.y;
			protons[i].x = protons[i].x - Math.floor((protons[i].x + off_screen_gap)/width_with_gap)*width_with_gap;
			protons[i].y = protons[i].y - Math.floor((protons[i].y + off_screen_gap)/height_with_gap)*height_with_gap;
		}
	}
	for(let i = 0; i < neutrons.length; i++) {
		let n = neutrons[i];
		if(n.bound != undefined) {
			let vx_rel = (n.vx - n.bound.vx)/2;// relative to binary com
			let vy_rel = (n.vy - n.bound.vy)/2;
			let v_rel = Math.sqrt(vx_rel**2 + vy_rel**2);
			let vx_mean = (n.vx + n.bound.vx)/2;
			let vy_mean = (n.vy + n.bound.vy)/2;
			let x_mean = (n.x + n.bound.x)/2;
			let y_mean = (n.y + n.bound.y)/2;
			
			let phi = Math.atan2(n.y - y_mean, n.x - x_mean);
			let dir = Math.sign(vx_rel*(n.y - y_mean) - vy_rel*(n.x - x_mean));
			let alpha = -delta*v_rel/(dist_coll/2) * dir;
			
			x_mean = x_mean - Math.floor((x_mean + off_screen_gap)/width_with_gap)*width_with_gap;
			y_mean = y_mean - Math.floor((y_mean + off_screen_gap)/height_with_gap)*height_with_gap;

			n.x = x_mean + dist_coll*Math.cos(phi + alpha)/2 + vx_mean*delta + offset.x;
			n.y = y_mean + dist_coll*Math.sin(phi + alpha)/2 + vy_mean*delta + offset.y;
			n.vx = vx_mean + v_rel*Math.cos(phi + alpha - dir*Math.PI/2);
			n.vy = vy_mean + v_rel*Math.sin(phi + alpha - dir*Math.PI/2);
			n.bound.x = x_mean - dist_coll*Math.cos(phi + alpha)/2 + vx_mean*delta + offset.x;
			n.bound.y = y_mean - dist_coll*Math.sin(phi + alpha)/2 + vy_mean*delta + offset.y;
			n.bound.vx = vx_mean - v_rel*Math.cos(phi + alpha - dir*Math.PI/2);
			n.bound.vy = vy_mean - v_rel*Math.sin(phi + alpha - dir*Math.PI/2);

			if(Math.random() < 1 - Math.exp(-decay_rate*delta)) {

				let x_rel = n.x - x_mean;
				let y_rel = n.x - x_mean;

				n.vx += x_rel*n.energy_stored/(dist_coll/2)
				n.vy += y_rel*n.energy_stored/(dist_coll/2)
				n.bound.vx -= x_rel*n.energy_stored/(dist_coll/2)
				n.bound.vy -= y_rel*n.energy_stored/(dist_coll/2)

				n.bound.bound = undefined;
				n.bound = undefined;

			}
		}
	}

	for(let i = 0; i < protons.length; i++) {
		for(let j = 0; j < neutrons.length; j++) {
			if (neutrons[j].bound || protons[i].bound) {
				// TODO: allow this
				continue;
			}
			if((protons[i].x - neutrons[j].x)*(protons[i].x - neutrons[j].x) + (protons[i].y - neutrons[j].y)*(protons[i].y - neutrons[j].y) < dist_coll*dist_coll) {
				// newNucleus(
				// 	(protons[i].x + neutrons[j].x)/2,
				// 	(protons[i].y + neutrons[j].y)/2,
				// 	(protons[i].vx + neutrons[j].vx)/2,
				// 	(protons[i].vy + neutrons[j].vy)/2
				// 	);
				// neutron_container.removeChildAt(j);
				// proton_container.removeChildAt(i);
				// neutrons.splice(j, 1); j--;
				// protons.splice(i, 1); i--;
				neutrons[j].bound = protons[i];
				protons[i].bound = neutrons[j];
				// Shift to orbit
				let x_com = (neutrons[j].x + protons[i].x)/2;
				let y_com = (neutrons[j].y + protons[i].y)/2;
				let phi = Math.atan2(neutrons[j].y - y_com, neutrons[j].x - x_com);
				neutrons[j].x = x_com + dist_coll/2 * Math.cos(phi);
				neutrons[j].y = y_com + dist_coll/2 * Math.sin(phi);
				protons[i].x = x_com - dist_coll/2 * Math.cos(phi);
				protons[i].y = y_com - dist_coll/2 * Math.sin(phi);
				// Remove radial velocity component
				let x_rel = (neutrons[j].x - protons[i].x)/2;
				let y_rel = (neutrons[j].y - protons[i].y)/2;
				let vx_com = (neutrons[j].vx + protons[i].vx)/2;
				let vy_com = (neutrons[j].vy + protons[i].vy)/2;
				// let vx_rel = (neutrons[j].vx - protons[i].vx)/2;
				// let vy_rel = (neutrons[j].vy - protons[i].vy)/2;
				let v_r_proj_n = (neutrons[j].vx - vx_com)*x_rel + (neutrons[j].vy - vy_com)*y_rel;
				let v_r_proj_p = (protons[i].vx - vx_com)*x_rel + (protons[i].vy - vy_com)*y_rel;
				neutrons[j].energy_stored = v_r_proj_n/(dist_coll/2);
				neutrons[j].vx = neutrons[j].vx - v_r_proj_n*x_rel*4/(dist_coll*dist_coll);
				neutrons[j].vy = neutrons[j].vy - v_r_proj_n*y_rel*4/(dist_coll*dist_coll);
				protons[i].vx = protons[i].vx - v_r_proj_p*x_rel*4/(dist_coll*dist_coll);
				protons[i].vy = protons[i].vy - v_r_proj_p*y_rel*4/(dist_coll*dist_coll);

				// neutrons[j]
				break;
			}
		}
	}
	debug_text.text = "#Nuclei = " + nuclei.length + ", alpha = " + decay_rate + ", v_mean = " + v_mean + ", dist_coll = " + dist_coll + ", lambda = " + 1/(density*2*dist_coll) + ", density = " + density;
	for(let i = 0; i < nuclei.length; i++) {
		if(Math.random() < 1 - Math.exp(-decay_rate*delta)) {
			nucleon_container.removeChildAt(i);
			let angle = Math.random()*2*Math.PI;
			let speed = 2*Math.random();
			addNeutron(new Neutron(
				nuclei[i].x + 15*Math.cos(angle),
				nuclei[i].y + 15*Math.sin(angle),
				nuclei[i].vx + speed*Math.cos(angle),
				nuclei[i].vy + speed*Math.sin(angle)
			));
			addProton(new Proton(
				nuclei[i].x + 15*Math.cos(angle + Math.PI),
				nuclei[i].y + 15*Math.sin(angle + Math.PI),
				nuclei[i].vx + speed*Math.cos(angle + Math.PI),
				nuclei[i].vy + speed*Math.sin(angle + Math.PI)
			));
			nuclei.splice(i, 1); i--;
		}
	}
	offset.x = 0;
	offset.y = 0;
}

function keyboard(value: string) {
	// from https://github.com/kittykatattack/learningPixi#movingexplorer
	const key = {
		value: value,
		isDown: false,
		isUp: true,
		press: () => undefined,//void return type had parser error
		release: () => undefined,
		downHandler: (_: KeyboardEvent) => undefined,
		upHandler: (_: KeyboardEvent) => undefined,
		unsubscribe: () => undefined
	};
		
	//The `downHandler`
	key.downHandler = (event) => {
			if (event.code === key.value) {
				if (key.isUp && key.press) {
				key.press();
				}
				key.isDown = true;
				key.isUp = false;
				event.preventDefault();
			}
			return undefined;
		};
	
		//The `upHandler`
	key.upHandler = (event) => {
			if (event.code === key.value) {
				if (key.isDown && key.release) {
				key.release();
				}
				key.isDown = false;
				key.isUp = true;
				event.preventDefault();
			}
			return undefined;
		};
  
	//Attach event listeners
	const downListener = key.downHandler.bind(key);
	const upListener = key.upHandler.bind(key);
	
	window.addEventListener("keydown", downListener, false);
	window.addEventListener("keyup", upListener, false);
	
	// Detach event listeners
	key.unsubscribe = () => {
	  window.removeEventListener("keydown", downListener);
	  window.removeEventListener("keyup", upListener);
	  return undefined;
	};
	
	return key;
  }