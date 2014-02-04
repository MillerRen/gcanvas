/**
 * Derived from code originally written by zz85 for three.js
 * http://www.lab4games.net/zz85/blog
 * Thanks zz85!
 **/

module.exports = SubPath;

var Point = require('./math/point')
  , ClipperLib = require('./clipper')
  , Path = require('./path');

function SubPath( points ) {
	this.actions = [];
  this.pointsCache = [];

	if ( points ) {
		this.fromPoints( points );
	}
};

SubPath.actions = {
	MOVE_TO: 'moveTo',
	LINE_TO: 'lineTo',
	QUADRATIC_CURVE_TO: 'quadraticCurveTo',
	BEZIER_CURVE_TO: 'bezierCurveTo',
	ELLIPSE: 'ellipse'
};

SubPath.prototype = {
  clone: function() {
    var path = new SubPath();
    path.actions = this.actions.slice(0);
    return path;
  }

, toPath: function() {
   var clone = this.clone();
   var path = new Path();
   path.subPaths.push(clone);
   return path;
  }

, firstPoint: function() {
    var p = new Point(0,0);
    var args = this.actions[0].args;
    p.x = args[args.length-2];
    p.y = args[args.length-1];
    return p;
  }

, addAction: function(action) {
    this.actions.push(action);
    this.pointsCache = [];
  }

, lastPoint: function() {
    var p = new Point(0,0);
    var args = this.actions[this.
      actions.length-1].args;
    p.x = args[args.length-2];
    p.y = args[args.length-1];
    return p;
  }

, fromPoints: function ( points ) {
    this.moveTo( points[ 0 ].x, points[ 0 ].y );

    for ( var v = 1, vlen = points.length; v < vlen; v ++ ) {
      this.lineTo( points[ v ].x, points[ v ].y );
    };
  }

, getLength: function() {
    var args, x1=0, y1=0, x2=0, y2=0, xo=0, yo=0, len=0;

    var first = this.firstPoint();
    x2 = first.x;
    y2 = first.y;

    var pts = this.getPoints();
    for(var i=0,l=pts.length; i < l; ++i) {
      var p=pts[i];
      x1 = x2;
      y1 = y2;
      x2 = p.x;
      y2 = p.y;
      xo = x2-x1;
      yo = y2-y1;

      len += Math.sqrt(xo*xo + yo*yo);
    }

    // for ( i = 1, il = this.actions.length; i < il; i ++ ) {
    //   args = this.actions[i].args;
    //   x1 = x2;
    //   y1 = y2;
    //   x2 = args[args.length-2];
    //   y2 = args[args.length-1];
    //   xo = x2-x1;
    //   yo = y2-y1;

    //   len += Math.sqrt(xo*xo + yo*yo);
    // }

    return len;
  }

, getLength2: function() {
    var args, x1=0, y1=0, x2=0, y2=0, xo=0, yo=0, len=0;

    for ( i = 1, il = this.actions.length; i < il; i ++ ) {
      args = this.actions[i].args;
      x1 = x2;
      y1 = y2;
      x2 = args[args.length-2];
      y2 = args[args.length-1];
      xo = x2-x1;
      yo = y2-y1;

      len += Math.sqrt(xo*xo + yo*yo);
    }

    return len;
  }

, nearestPoint: function(p1) {
    var p2 = new Point()
      , args
      , rn
      , rp
      , rd = Infinity;

    this.actions.forEach(function(action,n) {
      args = action.args;
      p2.x = args[args.length-2];
      p2.y = args[args.length-1];

      var d = Point.distance(p1,p2);
      if(d < rd) {
        rn = n;
        rp = p2.clone();
        rd = d;
      }
    });

    return {
      i: rn
    , distance: rd
    , point: rp
    };
  }

, pointAt: function(an) {
    var p = new Point();
    var args = this.actions[an].args;
    p.x = args[args.length-2];
    p.y = args[args.length-1];
    return p;
  }

, shift: function(an) {
    if(an === 0) return this;

    var result = new SubPath();


    result.actions = this.actions.slice(an).concat(
      this.actions.slice(0,an)
    );

    result.actions.forEach(function(a) {
      a.action = SubPath.actions.LINE_TO;
    });

    result.lineTo.apply(result, result.actions[0].args);

    return result;
  }

, moveTo: function ( x, y ) {
    this.addAction( { action: SubPath.actions.MOVE_TO, args: arguments } );
  }

, lineTo: function ( x, y ) {
    this.addAction( { action: SubPath.actions.LINE_TO, args: arguments } );
  }

, quadraticCurveTo: function( aCPx, aCPy, aX, aY ) {
    this.addAction( { action: SubPath.actions.QUADRATIC_CURVE_TO, args: arguments } );
  }

, bezierCurveTo: function( aCP1x, aCP1y,
                           aCP2x, aCP2y,
                           aX, aY ) {
    this.addAction( { action: SubPath.actions.BEZIER_CURVE_TO, args: arguments } );
  }

, arc: function ( aX, aY, aRadius, aStartAngle, aEndAngle, aClockwise ) {
    this.ellipse(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
  }

, ellipse: function ( aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise ) {
    this.addAction( { action: SubPath.actions.ELLIPSE, args: arguments } );
  }

, getPoints: function( divisions ) {

    divisions = divisions || 40;

    if(this.pointsCache[divisions]) {
      return this.pointsCache[divisions];
    }


    var points = [];

    var i, il, item, action, args;
    var cpx, cpy, cpx2, cpy2, cpx1, cpy1, cpx0, cpy0,
      laste, j,
      t, tx, ty;

    for ( i = 0, il = this.actions.length; i < il; i ++ ) {

      item = this.actions[ i ];

      action = item.action;
      args = item.args;

      switch( action ) {

      case SubPath.actions.MOVE_TO:

        points.push( new Point( args[ 0 ], args[ 1 ] ) );

        break;

      case SubPath.actions.LINE_TO:

        points.push( new Point( args[ 0 ], args[ 1 ] ) );

        break;

      case SubPath.actions.QUADRATIC_CURVE_TO:

        cpx  = args[ 2 ];
        cpy  = args[ 3 ];

        cpx1 = args[ 0 ];
        cpy1 = args[ 1 ];

        if ( points.length > 0 ) {

          laste = points[ points.length - 1 ];

          cpx0 = laste.x;
          cpy0 = laste.y;

        } else {

          laste = this.actions[ i - 1 ].args;

          cpx0 = laste[ laste.length - 2 ];
          cpy0 = laste[ laste.length - 1 ];

        }

        for ( j = 1; j <= divisions; j ++ ) {

          t = j / divisions;

          tx = b2( t, cpx0, cpx1, cpx );
          ty = b2( t, cpy0, cpy1, cpy );

          points.push( new Point( tx, ty ) );

        }

        break;

      case SubPath.actions.BEZIER_CURVE_TO:

        cpx  = args[ 4 ];
        cpy  = args[ 5 ];

        cpx1 = args[ 0 ];
        cpy1 = args[ 1 ];

        cpx2 = args[ 2 ];
        cpy2 = args[ 3 ];

        if ( points.length > 0 ) {

          laste = points[ points.length - 1 ];

          cpx0 = laste.x;
          cpy0 = laste.y;

        } else {

          laste = this.actions[ i - 1 ].args;

          cpx0 = laste[ laste.length - 2 ];
          cpy0 = laste[ laste.length - 1 ];

        }

        for ( j = 1; j <= divisions; j ++ ) {

          t = j / divisions;

          tx = b3( t, cpx0, cpx1, cpx2, cpx );
          ty = b3( t, cpy0, cpy1, cpy2, cpy );

          points.push( new Point( tx, ty ) );

        }

        break;

      case SubPath.actions.ELLIPSE:

        var aX = args[ 0 ], aY = args[ 1 ],
          xRadius = args[ 2 ],
          yRadius = args[ 3 ],
          aStartAngle = args[ 4 ], aEndAngle = args[ 5 ],
          aClockwise = !!args[ 6 ];

        var deltaAngle = aEndAngle - aStartAngle;
        var angle;

        for ( j = 0; j <= divisions; j ++ ) {
          t = j / divisions;

          if(deltaAngle === -Math.PI*2) {
            deltaAngle = Math.PI*2;
          }

          if(deltaAngle < 0) {
            deltaAngle += Math.PI*2;
          }

          if(deltaAngle > Math.PI*2) {
            deltaAngle -= Math.PI*2;
          }

          if ( aClockwise ) {
            // sin(pi) and sin(0) are the same
            // So we have to special case for full circles
            if(deltaAngle === Math.PI*2) {
              deltaAngle = 0;
            }

            angle = aEndAngle + ( 1 - t ) * ( Math.PI * 2 - deltaAngle );
          } else {
            angle = aStartAngle + t * deltaAngle;
          }

          var tx = aX + xRadius * Math.cos( angle );
          var ty = aY + yRadius * Math.sin( angle );

          points.push( new Point( tx, ty ) );

        }

        break;

      } // end switch
    }

    if(this.closed) {
      points.push( points[ 0 ] );
    }

    this.pointsCache[divisions] = points;
    return points;
  }
, toPoly: function(scale) {
    return this.getPoints(40).map(function(p) {
      return {X: p.x*scale, Y: p.y*scale};
    });
  }
, fromPoly: function(poly, scale) {
    scale = 1/scale;

    this.moveTo(poly[0].X*scale, poly[0].Y*scale);

    for(var i=1,l=poly.length; i < l; ++i) {
      this.lineTo(poly[i].X*scale, poly[i].Y*scale);
    }
    // todo: close properly (closePath())
    this.lineTo(poly[0].X*scale, poly[0].Y*scale);
    return this;
  }
};


// Bezier Curves formulas obtained from
// http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bezier Functions
function b2p0 ( t, p ) {
  var k = 1 - t;
  return k * k * p;
}

function b2p1 ( t, p ) {
  return 2 * ( 1 - t ) * t * p;
}

function b2p2 ( t, p ) {
  return t * t * p;
}

function b2 ( t, p0, p1, p2 ) {
  return b2p0( t, p0 ) + b2p1( t, p1 ) + b2p2( t, p2 );
}

// Cubic Bezier Functions
function b3p0 ( t, p ) {
  var k = 1 - t;
  return k * k * k * p;
}

function b3p1 ( t, p ) {
  var k = 1 - t;
  return 3 * k * k * t * p;
}

function b3p2 ( t, p ) {
  var k = 1 - t;
  return 3 * k * t * t * p;
}

function b3p3 ( t, p ) {
  return t * t * t * p;
}

function b3 ( t, p0, p1, p2, p3 ) {
  return b3p0( t, p0 ) + b3p1( t, p1 ) + b3p2( t, p2 ) +  b3p3( t, p3 );
}
