function AudioPlayer(playerElement)
{
	"use strict";
	var self = this;
	
	/*
		soundcloud api stuff
	*/
	
	var SCClientId = "b1c99498f710af04d6c2b0c89d0f013a";
	SC.initialize({
		client_id: SCClientId
	});
	
	/*
		web audio api stuff
	*/
	
	var player = document.getElementById(playerElement);
	player.crossOrigin = "anonymous";
	var currentlyPlayingUrl;
	var currentlyPlayingTitle;
	
	var soundcloudUrlTextbox = document.getElementById("soundcloudUrlTextbox");
	var audioContext = new (window.AudioContext || window.webkitAudioContext)();
	
	var source = audioContext.createMediaElementSource(player);
	source.connect(audioContext.destination);
	
	var analyser = audioContext.createAnalyser();
	source.connect(analyser);
	analyser.minDecibels = -140;
	analyser.maxDecibels = 0;
	analyser.fftSize = 128; //size of data arrays will be half of this
	var freqData = new Uint8Array(analyser.frequencyBinCount);
	var timeData = new Uint8Array(analyser.frequencyBinCount);
	
	/*
		three.js stuff
	*/
	
	var vFov = 75; //three js uses vertical fov
	var scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x000000, 25, 100 );
	var camera = new THREE.PerspectiveCamera(vFov, window.innerWidth / window.innerHeight, 0.1, 1000);
	var maxBarHeight = 10;
	
	var meshArray = [];
	var renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor(0x000000, 1);
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);
	
	// lighting
	var ambientLight = new THREE.AmbientLight(0x000000);
	scene.add(ambientLight);
	
	var lights = [];
	lights[0] = new THREE.PointLight(0xffffff, 1, 0);
	lights[1] = new THREE.PointLight(0xffffff, 1, 0);
	lights[2] = new THREE.PointLight(0xffffff, 1, 0);

	lights[0].position.set(0, 200, 0);
	lights[1].position.set(100, 200, 100);
	lights[2].position.set(-100, -200, -100);

	scene.add(lights[0]);
	scene.add(lights[1]);
	scene.add(lights[2]);
	
	// visualiser bars
	var mesh = new THREE.Object3D();
	var geometry = new THREE.BoxGeometry(1, 1, 1);
	mesh.add(new THREE.Mesh(
		geometry,
		new THREE.MeshPhongMaterial({
			color: 0x156289,
			emissive: 0x072534,
			side: THREE.DoubleSide,
			shading: THREE.FlatShading
		})
	));
	
	// add cloned objects to the scene
	for (var i = 0; i < analyser.frequencyBinCount; i++)
	{
		var clone = mesh.clone();
		scene.add(clone);
		clone.position.x = i * 1.1; //make the bars more distinct by separating them
		meshArray.push(clone);
	}
	
	
	
	// various event listeners
	window.addEventListener('resize', onResize, false );
	document.addEventListener("mousedown", onMouseDown, false);
	document.addEventListener("mousewheel", onMouseWheel, false);
	document.addEventListener("DOMMouseScroll", onMouseWheel, false); // firefox
	
	function onResize()
	{
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}
	
	function onMouseWheel(event)
	{
		var newZ = 0;
		
		if (event.wheelDelta)
		{
			var newZ = camera.position.z - event.wheelDelta / 100;
		}
		else if (event.detail) // firefox
		{
			var newZ = camera.position.z + event.detail / 10;
		}
		
		if (newZ > 10 && newZ < 50)
		{
			camera.position.z = newZ;
		}
	}
	
	function render()
	{
		analyser.getByteFrequencyData(freqData);
		analyser.getByteTimeDomainData(timeData);
		
		updateFreqVisualiser();
		
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}
	
	function setCameraDirection(repositionCamera)
	{
		// make sure visualiser stays on screen
		var hFovRad = 2 * Math.atan( Math.tan( camera.fov * Math.PI / 180 / 2 ) * camera.aspect );
		var firstX = meshArray[0].position.x;
		var lastX = meshArray[meshArray.length - 1].position.x;
		var halfX = (lastX - firstX) / 2;
		
		if (repositionCamera)
		{
			var adjacent = halfX / Math.tan(hFovRad / 2); //toa
			camera.position.set(halfX, maxBarHeight, adjacent);
		}
		
		camera.lookAt(new THREE.Vector3(halfX, maxBarHeight/2, 0));
	}
	
	function onMouseDown()
	{
		document.addEventListener("mousemove", onMouseMove, false);
		document.addEventListener("mouseup", onMouseUp, false);
	}
	
	function onMouseUp()
	{
		document.removeEventListener("mousemove", onMouseMove, false);
		document.removeEventListener("mouseup", onMouseUp, false);
	}
	
	function onMouseMove(event)
	{
		var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
		var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
		
		var newX = camera.position.x - movementX / 50;
		var newY = camera.position.y + movementY / 50;
		
		if (newX > meshArray[0].position.x && newX < meshArray[meshArray.length - 1].position.x)
		{
			camera.position.x = newX;
		}
		if (newY > -50 && newY < 50)
		{
			camera.position.y = newY;
		}
		
		setCameraDirection(false);
	}
	
	AudioPlayer.prototype.startRender = function()
	{
		setCameraDirection(true);
		render();
	}
	
	// takes a normal browser soundcloud url, resolves the real url, gets the mp3 stream and then starts playing it
	AudioPlayer.prototype.playSong = function()
	{
		var soundcloudUrl = soundcloudUrlTextbox.value;
		
		// check if soundcloud url + add https if missing
		var httpslessUrl = /soundcloud\.com\/.+/.exec(soundcloudUrl)[0];
		
		if (!httpslessUrl)
		{
			return;
		}
		
		soundcloudUrl = "https://" + httpslessUrl;
		
		// if already loaded, play
		if (soundcloudUrl === self.currentlyPlayingUrl)
		{
			player.play();
			return;
		}
		
		console.log("Resolving SC URL: " + soundcloudUrl);
		SC.resolve(soundcloudUrl)
		.then(function(resolved) {
			var uri = /\/tracks\/\d+\/stream/.exec(resolved.stream_url)[0];
			if (!uri)
			{
				console.log("Failed to resolve URI");
				return;
			}
			uri += "s";
			console.log("Resolved to: " + resolved.stream_url);
			console.log("Song title: " + resolved.title);
			SC.get(uri)
				.then(function(streams) {
					console.log("Streaming...");
					player.src = streams.http_mp3_128_url;
					player.autoplay = true;
					self.currentlyPlayingUrl = soundcloudUrl;
					self.currentlyPlayingTitle = resolved.title;
					document.location.hash = encodeURI(self.currentlyPlayingUrl);
				}).catch(function(error){
					console.log('Error: ' + error.message);
				});
		})
		.catch(function(error){
			console.log('Error: ' + error.message);
		});
	}
	
	AudioPlayer.prototype.debug = function()
	{
		console.log(camera);
	}
	
	var updateFreqVisualiser = function()
	{
		for (var i = 0; i < analyser.frequencyBinCount; i++)
		{
			var x = freqData[i] / 256; // 0 <= x <= 1;
			meshArray[i].scale.y = x * maxBarHeight + 0.001; // 0.001 <= x <= 10.001
			meshArray[i].position.y = meshArray[i].scale.y / 2; // bottom of box stays at same position
		}
	}
}

