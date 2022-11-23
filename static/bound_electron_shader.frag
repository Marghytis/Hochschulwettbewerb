#define PI 3.1415926535897932384626433832795
#define N_MAX 1000
precision mediump float;
uniform float time; //Declare that we're using this uniform
varying vec2 vTextureCoord;//The coordinates of the current pixel
uniform sampler2D uSampler;//The image data
uniform vec2 pos[N_MAX];
uniform int nElectrons;
uniform int nNuclei;

void main(void) {
   float closest_dist_sq =999999999.0;
   float dist_sq = 0.0;
   int i_closest = -1;
   for(int i = 0; i < N_MAX; i++) {
      if(i >= nNuclei) {
         break;
      }
      dist_sq = (gl_FragCoord.x - pos[i].x)*(gl_FragCoord.x - pos[i].x) + (gl_FragCoord.y - pos[i].y)*(gl_FragCoord.y - pos[i].y);
      if(dist_sq < closest_dist_sq) {
         closest_dist_sq = dist_sq;
         i_closest = i;
      }
   }
   float dist = sqrt(closest_dist_sq) - 40.0; 
   float angle = atan(gl_FragCoord.y, gl_FragCoord.x);

   float a = 20.0;
   float fac = 0.5*(1.0 - dist/(float(nElectrons-1)*a) + mod((dist + 2.0*sin(dist/a + 4.0*angle+time))/a, 1.0)/float(nElectrons-1));// + 0.2*(sin(10.0*angle - dist/a) - 0.5);

   gl_FragColor = vec4(0.8*fac, 0.8*fac, 0.8*fac, fac);
}