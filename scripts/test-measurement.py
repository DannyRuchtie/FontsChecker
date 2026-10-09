import unittest,sys,base64
from pathlib import Path
from io import BytesIO
from PIL import Image,ImageDraw,ImageFont,ImageOps
sys.path.insert(0,str(Path(__file__).parent))
import importlib.util
spec=importlib.util.spec_from_file_location('measure',Path(__file__).with_name('measure-font.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);run=module.run

class MeasurementTests(unittest.TestCase):
 def fixture(self,tracking=0,text="Hamburg"):
  root=Path('.cache/fonts/inter')
  # Use an authoritative default Inter instance rather than whichever cache file is first.
  from fontTools.ttLib import TTFont
  from fontTools.varLib.instancer import instantiateVariableFont
  f=TTFont(root/'InterVariable.woff2');f=instantiateVariableFont(f,{'wght':400,'opsz':14},inplace=False);f.flavor=None;buf=BytesIO();f.save(buf)
  font=ImageFont.truetype(BytesIO(buf.getvalue()),48);im=Image.new('RGB',(600,100),'white');d=ImageDraw.Draw(im);x=10
  for c in text:
   d.text((x,10),c,font=font,fill='black');x+=font.getlength(c)+tracking
  output=BytesIO();im.save(output,format='PNG');return {'directory':str(root),'image':'data:image/png;base64,'+base64.b64encode(output.getvalue()).decode(),'text':text}
 def test_matching_shapes_and_tracking(self):
  a=run(self.fixture());b=run(self.fixture(8));self.assertEqual(a['status'],'measured');self.assertEqual(b['status'],'measured');self.assertGreater(a['best']['shapeSimilarity'],90);self.assertGreater(b['best']['shapeSimilarity'],90);self.assertGreater(b['best']['spacingMeanDifferencePx'],a['best']['spacingMeanDifferencePx']+4)
 def test_punctuation_and_unicode(self):
  for text in ['Hamburg!', 'Café']:
   result=run(self.fixture(text=text));self.assertEqual(result['status'],'measured',result);self.assertGreater(result['best']['shapeSimilarity'],90)
 def test_ocr_control_artifact_is_removed(self):
  r=self.fixture();r['text']='Hamburg\x7f';result=run(r);self.assertEqual(result['status'],'measured');self.assertEqual(result['text'],'Hamburg')
 def test_empty_text_has_actionable_message(self):
  r=self.fixture();r['text']='\x7f';result=run(r);self.assertEqual(result['status'],'not_checked');self.assertIn('Type the words',result['reason'])
 def test_white_text_inside_black_panel(self):
  r=self.fixture();im=Image.open(BytesIO(base64.b64decode(r['image'].split(',')[1]))).convert('RGB');im=ImageOps.invert(im);canvas=Image.new('RGB',(640,140),'white');canvas.paste(im,(20,20));buf=BytesIO();canvas.save(buf,format='PNG');r['image']='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode();result=run(r);self.assertEqual(result['status'],'measured',result)
 def test_repeated_native_word_boxes_are_not_individual_letters(self):
  r=self.fixture();r['ocr']={'lines':[{'text':'Hamburg','confidence':1,'glyphs':[{'character':c,'x':0,'y':0,'width':1,'height':1} for c in 'Hamburg']}]};result=run(r);self.assertEqual(result['status'],'measured',result);self.assertGreater(result['best']['shapeSimilarity'],90);self.assertIn('OCR positions',result['segmentation'])
 def test_pixel_ocr_character_boxes(self):
  r=self.fixture();from PIL import ImageOps
  im=Image.open(BytesIO(base64.b64decode(r['image'].split(',')[1]))).convert('L');mask=im.point(lambda v:255 if v<128 else 0);parts=module.segments(mask);glyphs=[]
  for c,(left,right) in zip('Hamburg',parts):
   bb=mask.crop((left,0,right,mask.height)).getbbox();glyphs.append({'character':c,'x':left,'y':bb[1],'width':right-left,'height':bb[3]-bb[1]})
  r['ocr']={'lines':[{'text':'Hamburg','confidence':1,'pixels':True,'glyphs':glyphs}]};result=run(r);self.assertEqual(result['status'],'measured',result);self.assertGreater(result['best']['shapeSimilarity'],90)
 def test_wrong_transcription_is_not_checked(self):
  r=self.fixture();r['text']='Hello!';self.assertEqual(run(r)['status'],'not_checked')
if __name__=='__main__':unittest.main()
