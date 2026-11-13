# Copia el PDF de documentos del ERP (index.html) a nun-pdf.js, que usa la app de vendedores (ventas/index.html).
# Uso (desde la raíz del repo): python3 herramientas/copiar_pdf.py
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = open(os.path.join(R, 'index.html'), encoding='utf-8').read().split('\n')
def linea(ini):
    return next(l for l in L if l.startswith(ini))
def bloque(ini):
    i = next(k for k, l in enumerate(L) if l.startswith(ini)); j = next(k for k in range(i, len(L)) if L[k] in ('}', '};'))
    return '\n'.join(L[i:j + 1])
cab = open(os.path.join(R, 'nun-pdf.js'), encoding='utf-8').read().split('// ============================================================\n', 2)
encabezado = '// ============================================================\n' + cab[1] + '// ============================================================\n'
open(os.path.join(R, 'nun-pdf.js'), 'w', encoding='utf-8').write(encabezado + bloque('const fmtFechaLarga = (f) => {') + '\n' + bloque('function numeroALetras(num) {') + '\n' + bloque('function nunLineaCaja(it){') + '\n' + bloque('function imprimirDocumento(tipo, idDoc, soloHTML) {') + '\n'
    # v2.1.5 — timbre de la factura (QR del SAT y sellos), igual que en el ERP
    + bloque('function nunLogoPDF(){') + '\n' + bloque('function nunECHTMLDe(D){') + '\n' # v4.84 estado de cuenta en la app
    + linea('function cfdiGetTimbres(){') + '\n' + linea('function cfdiSetTimbres(s){') + '\n'
    + bloque('function cfdiTimbreData(xmlText){') + '\n' + bloque('function cfdiTimbreHTML(doc, totalNum){') + '\n'
    # v5.00 — PDF del complemento de pago (el vendedor lo descarga en su app)
    + linea('const SAT_FORMA_PAGO = [') + '\n' + bloque('function nunLeerREP(xml){') + '\n' + bloque('function nunHtmlREP(xml){') + '\n')
print('nun-pdf.js actualizado')
