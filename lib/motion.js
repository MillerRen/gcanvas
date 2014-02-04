module.exports = Motion;

var Point = require('./math/point')
  , Path = require('./path')
  , SubPath = require('./subpath')
  , utils = require('./utils');

/**
 * Realtime motion interface
 * This actually sends commands to the driver.
 * */
function Motion(ctx) {
  this.ctx = ctx;
  this.position = new Point(0,0,0);
  this.targetDepth = 0; // Current depth for plunge/retract
}

Motion.prototype = {
  retract: function() {
    this.rapid({z:this.ctx.aboveTop
               || this.ctx.top - this.ctx.surfaceTolerance});
  }
, plunge: function() {
    this.linear({z: this.targetDepth});
  }
, rapid: function(params) {
    var newPosition = this.postProcess(params);
    if(!newPosition) return;

    this.ctx.driver.rapid.call(this.ctx.driver, params);
    this.position = newPosition;
  }
, linear: function(params) {
    var newPosition = this.postProcess(params);
    if(!newPosition) return;

    this.ctx.driver.linear.call(this.ctx.driver, params);
    this.position = newPosition;
  }
, arcCW: function(params) {
    var newPosition = this.postProcess(params);

    // Can be cyclic so we don't
    // ignore it if the position is the same

    this.ctx.driver.arcCW.call(this.ctx.driver, params);

    if(newPosition) {
      this.position = newPosition;
    }
  }
, arcCCW: function(params) {
    if(this.applyFilter('arcCCW', params) === false)
      return;

    var newPosition = this.postProcess(params);

    this.ctx.driver.arcCCW.call(this.ctx.driver, params);

    if(newPosition) {
      this.position = newPosition;
    }
  }
, postProcess: function(params) {
    if(params.x)
      params.x = Math.round(params.x * 1000000) / 1000000;
    if(params.y)
      params.y = Math.round(params.y * 1000000) / 1000000;
    if(params.z)
      params.z = Math.round(params.z * 1000000) / 1000000;
    if(params.i)
      params.i = Math.round(params.i * 1000000) / 1000000;
    if(params.j)
      params.j = Math.round(params.j * 1000000) / 1000000;

    // Set new spindle atc changed
    if(this.ctx.driver.atc
       && this.ctx.atc != this.currentAtc) {
      this.ctx.driver.atc(this.ctx.atc);
      this.currentAtc = this.ctx.atc;
    }

    // Set new spindle speed changed
    if(this.ctx.driver.speed
       && this.ctx.speed != this.currentSpeed) {
      this.ctx.driver.speed(this.ctx.speed);
      this.currentSpeed = this.ctx.speed;
    }

    // Set new feedrate changed
    if(this.ctx.driver.feed
       && this.ctx.feed != this.currentFeed) {
      this.ctx.driver.feed(this.ctx.feed);
      this.currentFeed = this.ctx.feed;
    }

    // Set coolant if changed
    if(this.ctx.driver.coolant
       && this.ctx.coolant != this.currentCoolant) {
      this.ctx.driver.coolant(this.ctx.coolant);
      this.currentCoolant = this.ctx.coolant;
    }

    var v1 = new Point(
          params.x === undefined ? this.position.x : params.x
        , params.y === undefined ? this.position.y : params.y
        , params.z === undefined ? this.position.z : params.z);

    if(utils.samePos(this.position, v1)) {
      return false;
    }

    return v1;
  }

, applyFilter: function(method, args) {
    if(!this.filter || !this.filter[method]) return;
    return this.filter[method].apply(this, args);
  }

, followPath: function(path, filter) {
    if(path.subPaths) {
      path.subPaths.forEach(function(subPath) {
        this.followPath(subPath, filter);
      }, this);
      return;
    }

    var totalLen = path.getLength();
    var curLen = 0;
    var endDepth = this.targetDepth;
    var zStart = this.position.z;

    function helix() {
      var fullDelta = endDepth - zStart;
      var curDelta = fullDelta * (curLen / totalLen);
      return zStart + curDelta;
    }

    function applyFilter(obj) {
      if(!filter) {
        return obj;
      }

      filter.call(obj, motion.position, curLen, totalLen);

      return obj;
    }

    var each = {};
    var motion = this;
    var driver = this.ctx.driver;
    var item;

    each[Path.actions.MOVE_TO] = function(x,y) {
      // Optimize out 0 distances moves
      // This is useful for cyclic paths
      if(utils.sameFloat(x, this.position.x) &&
         utils.sameFloat(y, this.position.y)) {
        return;
      }

      motion.retract();
      motion.rapid(
        applyFilter({x:x,y:y})
      );

      zStart = motion.position.z;
    };

    each[Path.actions.LINE_TO] = function(x,y) {

      var xo = x - this.position.x;
      var yo = y - this.position.y;
      curLen += Math.sqrt(xo*xo + yo*yo);

      motion.linear(
        applyFilter({x:x,y:y,z:helix()})
      );
    };

    each[Path.actions.ELLIPSE] = function(x, y, rx, ry,
									  aStart, aEnd, aClockwise , mx, my) {
      // Detect plain arc
      if(false && utils.sameFloat(rx,ry) &&
        (driver.arcCW && !aClockwise) ||
        (driver.arcCCW && aClockwise) ) {
          var center = new Point(x, y);
          var points = utils.arcToPoints(center,
                                         aStart,
                                         aEnd,
                                         rx);
          var params = {
            x: points.end.x, y: points.end.y,
            i: x-points.start.x, j: y-points.start.y
          };

          params = applyFilter(params);

          if(aClockwise)
            motion.arcCCW(params);
          else
            motion.arcCW(params);
      }
      else {
        this._interpolate('ellipse', arguments, mx, my);
      }
    };

    each[Path.actions.BEZIER_CURVE_TO] = function() {
      this._interpolate('bezierCurveTo', arguments);
    };

    each[Path.actions.QUADRATIC_CURVE_TO] = function() {
      this._interpolate('quadraticCurveTo', arguments);
    };

    for(var i = 0, l = path.actions.length; i < l; ++i) {
      item = path.actions[i]

      // Every action should be plunged except for move
      if(item.action !== Path.actions.MOVE_TO) {
        // motion.plunge();
      }

      each[item.action].apply(this, item.args);
    }
  }

, _interpolate: function(name, args) {
    var path = new SubPath();
    path.moveTo(this.position.x, this.position.y);
    path[name].apply(path, args);

    var pts = path.getPoints(40);
    for(var i=0,l=pts.length; i < l; ++i) {
      var p=pts[i];
      this.linear({x:p.x, y:p.y});
    };
  }
};
