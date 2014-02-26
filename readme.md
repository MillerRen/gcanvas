Gcanvas
========
An HTML5 Canvas API implementation that generates Gcode for mill and/or lathe CNC. Runs in node and the browser. 

### Installation
First make sure you have [nodejs](http://nodejs.org) installed.
```
npm install -g gcanvas
```

### Example
example.js
```
function main(ctx) {
  ctx.translate(-90,0);
  ctx.toolDiameter = 1/8*25.4;
  ctx.depth = 5;
  ctx.font = '20pt Helvetiker';
  roundRect(ctx, 0,0,180,60,5);
  ctx.text('I  < 3  robots', 12, 40);
  ctx.fill('evenodd');
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
}
```
```
$ gcanvas example.js --test
```
![alt](examples/screeny.png)
```
$ gcanvas example.js | mycnc
```
![alt](examples/example-irl.jpg)

More examples: http://emery.denucc.io/gcanvas/examples

### Non-standard extensions to Canvas 

#### Properties

* `context.toolDiameter` This must be set for fill() to work because it has to calculate tool offsets. stroke() only requires toolDiameter if align is not center.

* `context.depth` Specifies the total Z depth to cut into the work relative to `context.top`. If not set the Z axis never changes. 

* `context.depthOfCut` Specifies an incrementing depth of cut in layers up to `context.depth`.

* `context.top` The Z offset to the top of work surface. When this is set all cuts with plunge down to this depth before spiraling to their full depth. Use cautiously. If the actual work surface is closer this will break tools.

* `context.feed` Sets the feedrate by sending a single F command.

* `context.speed` Sets the spindle speed by sending a single S command.

* `context.coolant` Can be true, false, "mist" (M07) or "flood" (M08). True defaults to "flood".

* `context.align` Can be 'inner', 'outer', or 'center' (default). Non-center alignment closes the path.

* `context.atc` Auto tool change. Sends `M06 T{context.atc}`. Make sure you update toolDiameter.

#### Methods

##### `ctx.filter(fn)`
Adds a post-processing function before Gcode generation that allows
you to change the parameters.
* `fn`: function(params)
        Params is an object containing the Gcode parameters
        before they get serialized.
        ex: {x:10,y:0}

##### `ctx.map(axes)`
Adds a filter that maps the standard coordinate system to another one.
* `axes`: A string representing the new coordinate system.
         ex: 'yzxa'
         You can also use '-' before any axis to make it negative.
         ex: 'z-xy'

##### `ctx.peckDrill(x, y, depth, peck)`
Drills to depth using a peck drilling strategy.
* `depth`: Full depth to drill to.
* `peck`: Length of each peck. (default: ctx.toolDiameter)

##### `ctx.lathe(x, y, attack, pitch, ccw)`
Turning, boring, and facing by controlling XYA to remove the current path as if it were the cross section of a cylinder centered about (0,0). The path is clipped to the bottom right quadrant.

* `attack`: 'inner', 'outer', or 'face'
            Use inner for boring, and outer for turning.
            'inner' removes material from the center of a hole outward.
            'outer' removes material from the perimeter of a cylinder inwards.
            'face' removes material from the face of a cylinder through its length.
* `pitch`: Distance to travel per a full rotation.
* `ccw`: `true` for Counter-clockwise rotation. (default: false) 

##### `ctx.latheMill(x, y, attack, pitch, ccw)`
Like lathe but instead of a rotary axis it generates helixes in XYZ.

* `attack`: 'inner', 'outer', or 'face'
            Use inner for boring, and outer for turning.
            'inner' removes material from the center of a hole outward.
            'outer' removes material from the perimeter of a cylinder inwards.
            'face' removes material top down.
            ![alt](examples/lathe-mill-attacks.png)

* `pitch`: Distance to travel per a full rotation.
* `ccw`: `true` for Counter-clockwise rotation. (default: false) 

##### `ctx.thread(x, y, attack, dmin, dmaj, pitch, start, length, ccw)`
Convenience method for turning threads.
Simply lathe() with a rectangular path.

* `attack`: 'inner' or 'outer'
* `dmin`: Minor diameter of threads.
* `dmaj`: Major diameter of threads.
* `pitch`: Distance between threads.
* `start`: Length to beginning of threads.
* `length`: Full length of threads.
* `ccw`: true for counter-clockwise rotation. (default: false) 

##### `ctx.threadMill(x, y, attack, dmin, dmaj, pitch, start, length)`
Convenience method for milling threads.
Simply latheMill() with a rectangular path.

* `attack`: 'inner' or 'outer'
* `dmin`: Minor diameter of threads.
* `dmaj`: Major diameter of threads.
* `pitch`: Distance between threads.
* `start`: Length to beginning of threads.
* `length`: Full length of threads.
* `ccw`: true for counter-clockwise rotation. (default: false) 


### Command line utility
GCanvas comes with a command line utility that you can use to write
machining tasks as simple standalone .js files. Just define a main(context) function in the script, and gcanvas will pass it a
pre-built context that outputs to stdout.

```
// helloworld.js
function main(ctx) {
  ctx.strokeText("Hello World");
}
```
```
$ gcanvas helloworld.js | serialportterm -baud 9600 /dev/tty.usbmodem1337
```

#### Setups and tool changes

The CLI exposes a global function `setup(name, fn)` which prompts for user
intervention and raises the Z axis to 0.

If the part requires multiple work setups and tool changes, break them into setup blocks:

```
setup('1/2" endmill', function(ctx) { 
  ctx.toolDiameter = 1/2*25.4;
  // ...
});

setup('face down', function(ctx) { 
  // ...
});
```

### As a library
```
var Gcanvas = require('gcanvas');

var driver = new Gcanvas.GcodeDriver({
  write: function(cmd) {
    console.log(cmd);
  }
});

var ctx = new Gcanvas(driver);
```

### Why

1. The most common machining tasks are 2.5D and can be done much faster with a little code than with CAD.
2. The Canvas API is well documented and prolific.
3. Especially good for parametric parts.
4. A lib for implementing more specific Javascript milling tools. e.g. svg, pcbs.


### Additional Notes

#### Center cutting and non-center cutting endmills.
  The strategy for filling always tries to avoid center cutting
  unless it is unavoidable. For instance, if you try to fill a 15mm circle with a 5mm endmill it will start by milling a 10mm circle and finish with a full 15mm circle, which can be done with a non-center cutting endmill. But, if you try to fill an 8mm circle with a 5mm endmill it will assume you have the right tool to do so, and proceed without caution. Just make sure that what you're telling Gcanvas to do is actually possible and you won't have any problems. It always tends to work out that we use the simplest tool for the job - mainly because they are cheaper. Knowing this, Gcanvas avoids a lot of annoying configuration by making the most conservative assumptions.
  
### License

MIT
