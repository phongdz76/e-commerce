import type { ServiceContent } from "@/types/customerService";
export function starterServiceContent(): ServiceContent {
  return {
    contact: {
      storeName: "SGTech",
      phone: "19002004",
      email: "sgtech@gmail.com",
      address: "387 Bình Thành, Quận Bình Tân, TP. Hồ Chí Minh",
      zaloUrl: "",
      mapUrl:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.1239976004895!2d106.58435777451757!3d10.801813958726004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b83ee842e07%3A0x2acdb55560c394d0!2zMzg3LCA1NyBCw6xuaCBUaMOgbmgsIEtodSBQaOG7kSA1LCBCw6xuaCBUw6JuLCBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e0!3m2!1svi!2s!4v1780799335446!5m2!1svi!2s",
    },
    pages: {
      contact: { title: "Contact us", intro: "Need help choosing a product or checking an order? Send a support request to SGTech.", sections: [{ title: "Product questions", text: "Link the product and selected option in your request so the team can check its details." }, { title: "Order support", text: "Select one of your orders when creating a support request. Messages and replies remain saved to your account." }] },
      shipping: { title: "Shipping & delivery", intro: "Review your delivery address and the current quote before ordering.", sections: [{ title: "Delivery fees", text: "The checkout quote shows the delivery fee and saved total for your selected products and address." }, { title: "Delivery progress", text: "Open Your Orders and select an order to view its recorded shipment status. Contact support for questions about availability or timing." }] },
      returns: { title: "Returns & exchanges", intro: "Ask the support team to review return or exchange options for your order.", sections: [{ title: "Before sending an item back", text: "Create a support request with the order and issue. Wait for the team's instructions before sending the item." }, { title: "Review of your request", text: "A support enquiry does not approve a return or confirm a refund. Review the saved order and refund status for the result." }] },
      warranty: { title: "Warranty enquiries", intro: "Ask about the warranty information for a product or a purchased item.", sections: [{ title: "Product information", text: "Check the selected product option's warranty information, or create a warranty enquiry linked to that product or order." }, { title: "Next steps", text: "The team reviews the item and request before confirming available next steps. An enquiry is not a completed warranty claim." }] },
    },
    faq: { title: "Frequently asked questions", intro: "Quick answers to help you shop at SGTech.", items: [
      { question: "How do I find a product?", answer: "Search in the header or browse the shop, then filter by category and brand.", keywords: ["product", "san pham", "buy", "mua"], href: "/products" },
      { question: "Where can I check my order?", answer: "Sign in and open Your Orders. Select an order to view its payment and recorded delivery status.", keywords: ["order", "track", "don hang", "theo doi"], href: "/orders" },
      { question: "How are delivery fees calculated?", answer: "Enter your delivery details at checkout and request a quote to see the current fee and saved total.", keywords: ["shipping", "delivery", "giao hang", "ship"], href: "/help/shipping" },
      { question: "How do I ask about a return?", answer: "Create a support request with your order and issue. Wait for review and instructions before returning an item.", keywords: ["return", "refund", "doi tra", "hoan tien"], href: "/help/returns" },
      { question: "How do I ask about warranty?", answer: "Choose Ask about warranty on a product or link a purchased order in a warranty support request.", keywords: ["warranty", "bao hanh"], href: "/help/warranty" },
      { question: "I forgot my password. What should I do?", answer: "Use Forgot password on the login page and follow the instructions sent to your account email.", keywords: ["password", "forgot", "quen mat khau"], href: "/forgot-password" },
    ] },
  };
}
export function unpublishedServiceContent(): ServiceContent {
  const content = starterServiceContent();
  content.contact = { storeName: "SGTech", phone: "", email: "", address: "", zaloUrl: "", mapUrl: "" };
  return content;
}
