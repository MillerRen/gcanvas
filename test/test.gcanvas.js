describe('GCanvas', function() {
  var expect = require('chai').expect
  var GCanvas = require('../')
  var TestDriver = require('./support/testdriver')

  var ctx, robot, hand;
  beforeEach(function() {
    robot = new TestDriver();
    hand = new TestDriver();
    ctx = new GCanvas(robot);
    ctx.depth = 0;
    ctx.depthOfCut = 0;
  });

  describe('#moveTo', function() {
    it('sends #rapid', function() {
      ctx.moveTo(10,10);
      ctx.stroke();
      hand.rapid({x:10,y:10});
      expect(robot.result).eql(hand.result);
    });

    it('retracts tool', function() {
      ctx.depth = 1;
      ctx.moveTo(0,0);
      ctx.lineTo(10,0);
      ctx.moveTo(10,10);
      ctx.stroke();

      hand.linear({z:1}); // plunge
      hand.linear({x:10,y:0}); // lineTo
      hand.linear({z:0}); // retract
      hand.rapid({x:10,y:10}); // moveTo

      expect(robot.result).eql(hand.result);
    });
  });

  describe('#lineTo', function() {
    it('sends #linear', function() {
      ctx.moveTo(0,0);
      ctx.lineTo(10,10);
      ctx.stroke();

      hand.linear({x:10,y:10});

      expect(robot.result).eql(hand.result);
    });

    it('just moves if no subpath', function() {
      ctx.lineTo(10,10);
      ctx.stroke();

      hand.rapid({x:10,y:10});

      expect(robot.result).eql(hand.result);
    });

    it('plunges tool', function() {
      ctx.depth = 1;
      ctx.moveTo(0,0);
      ctx.lineTo(10,10);
      ctx.stroke();

      hand.linear({z:1});
      hand.linear({x:10,y:10});

      expect(robot.result).eql(hand.result);
    });
  });

  describe('#arc', function() {
    it('sends native #arcCW when possible', function() {
      ctx.arc(10, 10, 10, 0, Math.PI);
      ctx.stroke();

      hand.rapid({x:20,y:10});
      hand.arcCW({x:0,y:10,i:10,j:10});

      expect(robot.result).eql(hand.result);
    });

    it('sends native #arcCCW when possible', function() {
      ctx.arc(10, 10, 10, 0, Math.PI, true);
      ctx.stroke();

      hand.rapid({x:20,y:10});
      hand.arcCCW({x:0,y:10,i:10,j:10});

      expect(robot.result).eql(hand.result);
    });

    it('plunges tool', function() {
      ctx.depth = 1;
      ctx.arc(10, 10, 10, 0, Math.PI);
      ctx.stroke();

      hand.rapid({x:20,y:10});
      hand.linear({z:1});
      hand.arcCW({x:0,y:10,i:10,j:10});

      expect(robot.result).eql(hand.result);
    });
  });

  describe('#fill', function() {
  });
});
