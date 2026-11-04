# Copia el PDF de documentos del ERP (index.html) a nun-pdf.js, que usa la app de vendedores (vendedores.html).
# Uso (desde la raíz del repo): python3 herramientas/copiar_pdf.py
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = open(os.path.join(R, 'index.html'), encoding='utf-8').read().split('\n')
def bloque(ini):
    i = next(k for k, l in enumerate(L) if l.startswith(ini)); j = next(k for k in range(i, len(L)) if L[k] in ('}', '};'))
    return '\n'.join(L[i:j + 1])
cab = open(os.path.join(R, 'nun-pdf.js'), encoding='utf-8').read().split('// ============================================================\n', 2)
encabezado = '// ============================================================\n' + cab[1] + '// ============================================================\n'
open(os.path.join(R, 'nun-pdf.js'), 'w', encoding='utf-8').write(encabezado + bloque('const fmtFechaLarga = (f) => {') + '\n' + bloque('function numeroALetras(num) {') + '\n' + bloque('function imprimirDocumento(tipo, idDoc) {') + '\n')
print('nun-pdf.js actualizado')
