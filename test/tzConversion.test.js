"use strict";
const tzConversion = require('../lib/tzConversion')
const assert = require('assert');

const JAN_1ST = "2017-01-01";
const AUG_1ST = "2017-08-01";

describe('00:00:00 --> 24:00:00', function() {
  describe('UTC Conversion', function() {
    it('from UTC', function() {
      assert.equal(tzConversion.convert(JAN_1ST, "18:00:00", "UTC"), "18:00:00");
    });
    it('from Europe/Helsinki in summer', function() {
      assert.equal(tzConversion.convert(AUG_1ST, "18:00:00", "Europe/Helsinki"), "15:00:00");
    });
    it('from Europe/Helsinki in winter', function() {
      assert.equal(tzConversion.convert(JAN_1ST, "18:00:00", "Europe/Helsinki"), "16:00:00");
    });
    it('from Europe/Berlin in summer', function() {
      assert.equal(tzConversion.convert(AUG_1ST, "18:00:00", "Europe/Berlin"), "16:00:00");
    });
    it('from Europe/Berlin in winter', function() {
      assert.equal(tzConversion.convert(JAN_1ST, "18:00:00", "Europe/Berlin"), "17:00:00");
    });
  });
});
describe('When < 00:00:00 OR > 24:00:00', function() {
  it('24:10:00 UTC', function() {
    assert.equal(tzConversion.convert(JAN_1ST, "24:10:00", "UTC"), "24:10:00");
  });
  it('-01:10:00 UTC', function() {
    assert.equal(tzConversion.convert(JAN_1ST, "-01:10:00", "UTC"), "-01:10:00");
  });
  it('-01:10:00 Europe/Berlin', function() {
    assert.equal(tzConversion.convert(JAN_1ST, "-01:10:00", "Europe/Berlin"), "-02:10:00");
  });
  it('-03:10:00 Europe/Berlin', function() {
    assert.equal(tzConversion.convert(AUG_1ST, "-01:10:00", "Europe/Berlin"), "-03:10:00");
  });
  it('25:10:00 Europe/Berlin', function() {
    assert.equal(tzConversion.convert(AUG_1ST, "25:10:00", "Europe/Berlin"), "23:10:00");
  });
  it('01:58:00 Europe/Berlin', function() {
    assert.equal(tzConversion.convert(AUG_1ST, "01:58:00", "Europe/Berlin"), "-00:02:00");
  });
  it('01:58:00 Europe/Berlin to Pacific/Kiritimati', function() {
    assert.equal(tzConversion.convert(AUG_1ST, "01:58:00", "Europe/Berlin", "Pacific/Kiritimati"), "13:58:00");
  });
});
