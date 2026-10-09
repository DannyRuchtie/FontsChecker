import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectOCRLine} from '../ocr-selection.mjs';
const headline={text:'I am Inter UI →',confidence:.92,bbox:{y0:30,y1:94}};
const labels={text:'Regular Italic Medium Italic Bold Italic Black Italic',confidence:.85,bbox:{y0:390,y1:408}};
test('OCR chooses prominent text before long small specimen labels',()=>assert.equal(selectOCRLine([labels,headline]),headline));
test('explicit transcription restricts automatic line selection',()=>assert.equal(selectOCRLine([labels,headline],labels.text),labels));
test('OCR does not invent a line when transcription differs',()=>assert.equal(selectOCRLine([headline],'January'),undefined));
