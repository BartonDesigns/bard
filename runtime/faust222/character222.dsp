declare name "Bard Character 222";
declare author "Bard project";
declare license "MIT";
declare description "Stereo character processor: bass-preserving saturation, upper-band chorus and tone filtering.";
import("stdfaust.lib");

mix = hslider("mix", 0.28, 0, 1, 0.001) : si.smoo;
drive = hslider("drive", 1.3, 1, 5, 0.001) : si.smoo;
tone = hslider("tone[unit:Hz]", 12000, 1800, 18000, 1) : si.smoo;
rate = hslider("rate[unit:Hz]", 0.38, 0.08, 3, 0.001) : si.smoo;
depth = hslider("depth[unit:ms]", 2.0, 0, 6, 0.001) : si.smoo;
chorus = hslider("chorus", 0.22, 0, 0.5, 0.001) : si.smoo;
level = hslider("level", 0.98, 0.6, 1.1, 0.001) : si.smoo;

// Keep sub fundamentals dry inside the character path. Only the upper band
// receives nonlinear drive or a modulated delay.
character(sign, x) = (low + top*(1-chorus) + delayed*chorus) : fi.lowpass(2, min(ma.SR*0.45,max(1800, tone)))
with {
  high = x : fi.highpass(2, 180);
  low = x-high;
  top = ma.tanh(high*max(1,drive))/max(1,drive);
  delay = (0.011 + depth*0.001*(0.5+0.5*sign*os.osc(rate)))*ma.SR;
  delayed = top : de.fdelay(8192,delay);
};
channel(sign,x) = (x*(1-mix)+character(sign,x)*mix)*level : fi.dcblockerat(10);
process = channel(1),channel(-1);
