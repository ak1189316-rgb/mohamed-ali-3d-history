/**
 * Gemini 3.8 Flash TTS proxy for the public GitHub Pages site.
 * Store GEMINI_API_KEY in Apps Script > Project Settings > Script properties.
 */
function doGet(e) {
  var callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^[A-Za-z_$][\w$]{0,100}$/.test(callback)) {
    return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  }
  var result;
  try {
    var text = String((e.parameter && e.parameter.text) || '').trim();
    if (!text || text.length > 1800) throw new Error('النص فارغ أو أطول من الحد المسموح');
    enforceDailyLimit_();
    var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error('أضف مفتاح Gemini في Script Properties باسم GEMINI_API_KEY');
    var payload = {
      model: 'gemini-3.8-flash-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text: text, annotations: [{
        type: 'speech_metadata',
        style: 'تحدث بالعربية المصرية الفصحى الواضحة، بصوت رجل ناضج دافئ وواثق، كراوٍ تاريخي محترف. ألقِ الخطاب بحيوية واتزان، مع مخارج حروف واضحة وإيقاع طبيعي ووقفات مناسبة.'
      }] }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: 'Charon' }] }
    };
    var response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey }, payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var status = response.getResponseCode();
    var body = JSON.parse(response.getContentText());
    if (status < 200 || status >= 300) {
      var message = body && body.error && body.error.message ? body.error.message : 'فشل إنشاء الصوت';
      throw new Error(message);
    }
    var audio = findAudioData_(body);
    if (!audio) throw new Error('لم تُرجع Gemini بيانات صوت');
    result = { audio: audio, mimeType: 'audio/wav' };
  } catch (err) {
    result = { error: String(err && err.message ? err.message : err).slice(0, 300) };
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function findAudioData_(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.data === 'string' && (value.type === 'audio' || value.mime_type === 'audio/wav' || value.mimeType === 'audio/wav')) return value.data;
  if (typeof value.audio === 'string') return value.audio;
  if (value.audio && typeof value.audio.data === 'string') return value.audio.data;
  for (var key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      var found = findAudioData_(value[key]);
      if (found) return found;
    }
  }
  return '';
}
function enforceDailyLimit_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
    var key = 'TTS_DAILY_' + today;
    var count = Number(props.getProperty(key) || 0);
    if (count >= 120) throw new Error('وصل الموقع إلى حد الاستخدام اليومي المجاني للصوت؛ حاول غدًا');
    props.setProperty(key, String(count + 1));
  } finally { lock.releaseLock(); }
}
