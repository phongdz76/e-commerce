export default function ExtensionCleanup() {
  const cleanupScript = `
    (function() {
      if (typeof window === 'undefined') return;
      var clean = function(el) {
        if (!el || el.nodeType !== 1) return;
        if (el.hasAttribute('bis_skin_checked')) el.removeAttribute('bis_skin_checked');
        if (el.hasAttribute('bis_register')) el.removeAttribute('bis_register');
        if (el.hasAttribute('bis_depth')) el.removeAttribute('bis_depth');
        if (el.hasAttribute('bis_size')) el.removeAttribute('bis_size');
      };
      try {
        var existing = document.querySelectorAll('[bis_skin_checked],[bis_register],[bis_depth],[bis_size]');
        for (var i = 0; i < existing.length; i++) clean(existing[i]);

        if (typeof MutationObserver !== 'undefined') {
          var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var m = mutations[i];
              if (m.type === 'attributes') {
                clean(m.target);
              } else if (m.addedNodes && m.addedNodes.length) {
                for (var j = 0; j < m.addedNodes.length; j++) {
                  var node = m.addedNodes[j];
                  if (node.nodeType === 1) {
                    clean(node);
                    if (node.querySelectorAll) {
                      var nested = node.querySelectorAll('[bis_skin_checked],[bis_register],[bis_depth],[bis_size]');
                      for (var k = 0; k < nested.length; k++) clean(nested[k]);
                    }
                  }
                }
              }
            }
          });
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['bis_skin_checked', 'bis_register', 'bis_depth', 'bis_size']
          });
        }
      } catch (err) {}
    })();
  `;

  return (
    <script
      id="extension-cleanup"
      dangerouslySetInnerHTML={{ __html: cleanupScript }}
    />
  );
}
