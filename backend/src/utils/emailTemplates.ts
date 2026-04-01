function emailLayout(title: string, contentHtml: string, ctaLabel?: string, ctaUrl?: string) {
  return `
  <div style="background:#f3f5f8; padding:24px; font-family: Arial, sans-serif; color:#1e293b;">
    <div style="max-width:620px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
      <div style="background:#0f3460; color:#ffffff; padding:18px 24px; font-size:22px; font-weight:700;">ITIW Connect</div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 14px; color:#0f3460; font-size:22px;">${title}</h2>
        ${contentHtml}
        ${ctaLabel && ctaUrl
          ? `<a href="${ctaUrl}" style="display:inline-block; margin-top:18px; background:#e94560; color:#ffffff; text-decoration:none; padding:12px 16px; border-radius:10px; font-weight:600;">${ctaLabel}</a>`
          : ""}
        <p style="margin:22px 0 0; color:#64748b; font-size:13px;">Equipo ITIW Connect</p>
      </div>
    </div>
  </div>`;
}

function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO").format(Math.round(value));
}

export function otpEmailTemplate(name: string, code: string): string {
  return emailLayout(
    "Codigo de verificacion",
    `<p style="margin:0 0 12px;">Hola ${name},</p>
     <p style="margin:0 0 16px;">Tu codigo OTP es:</p>
     <div style="font-size:34px; letter-spacing:8px; font-weight:700; color:#0f3460; margin-bottom:12px;">${code}</div>
     <p style="margin:0;">Este codigo vence en <strong>5 minutos</strong>.</p>`,
  );
}

export function resetPasswordTemplate(name: string, resetUrl: string): string {
  return emailLayout(
    "Recuperacion de contrasena",
    `<p style="margin:0 0 12px;">Hola ${name},</p>
     <p style="margin:0;">Recibimos una solicitud para restablecer tu contrasena. El enlace vence en <strong>2 horas</strong>.</p>`,
    "Cambiar contrasena",
    resetUrl,
  );
}

export function requestCreatedTemplate(description: string, categoryName: string): string {
  return emailLayout(
    "Nueva solicitud creada",
    `<p style="margin:0 0 10px;">Se registro una nueva solicitud en ITIW Connect.</p>
     <p style="margin:0 0 8px;"><strong>Categoria:</strong> ${categoryName}</p>
     <p style="margin:0;"><strong>Descripcion:</strong> ${description}</p>`,
  );
}

export function newQuoteTemplate(
  clientName: string,
  professionalName: string,
  amountCop: number,
  estimatedHours: number,
  requestUrl: string,
): string {
  const amount = formatCop(amountCop);

  return emailLayout(
    "Tienes un nuevo presupuesto",
    `<p style="margin:0 0 12px;">Hola ${clientName},</p>
     <p style="margin:0 0 8px;"><strong>Profesional:</strong> ${professionalName}</p>
     <p style="margin:0 0 8px;"><strong>Monto:</strong> $${amount} COP</p>
     <p style="margin:0;"><strong>Tiempo estimado:</strong> ${estimatedHours} horas</p>`,
    "Ver solicitud",
    requestUrl,
  );
}

export function quoteAcceptedTemplate(
  professionalName: string,
  amountCop: number,
  estimatedHours: number,
  requestDescription: string,
  dashboardUrl: string,
): string {
  const amount = formatCop(amountCop);

  return emailLayout(
    "Tu presupuesto fue aceptado",
    `<p style="margin:0 0 12px;">Hola ${professionalName},</p>
     <p style="margin:0 0 8px;">Tu presupuesto fue seleccionado por el cliente.</p>
     <p style="margin:0 0 8px;"><strong>Monto:</strong> $${amount} COP</p>
     <p style="margin:0 0 8px;"><strong>Tiempo estimado:</strong> ${estimatedHours} horas</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${requestDescription}</p>`,
    "Ir al dashboard",
    dashboardUrl,
  );
}

export function escrowPaymentTemplate(amountCop: number, requestDescription: string): string {
  const amount = formatCop(amountCop);

  return emailLayout(
    "Tu pago esta seguro en escrow",
    `<p style="margin:0 0 12px;">Recibimos el pago del cliente y ya quedo protegido en escrow.</p>
     <p style="margin:0 0 8px;"><strong>Monto:</strong> $${amount} COP</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${requestDescription}</p>`,
  );
}

export function paymentReleasedTemplate(amountCop: number, requestDescription: string, automatic: boolean): string {
  const amount = formatCop(amountCop);

  return emailLayout(
    automatic ? "Pago liberado automaticamente" : "Pago liberado al profesional",
    `<p style="margin:0 0 12px;">${automatic ? "El tiempo de escrow termino y se libero el pago automaticamente." : "El cliente confirmo el trabajo y se libero el pago."}</p>
     <p style="margin:0 0 8px;"><strong>Monto:</strong> $${amount} COP</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${requestDescription}</p>`,
  );
}

export function newChatMessageTemplate(senderName: string, content: string, requestDescription: string): string {
  return emailLayout(
    "Tienes un mensaje nuevo",
    `<p style="margin:0 0 12px;"><strong>${senderName}</strong> envio un nuevo mensaje.</p>
     <p style="margin:0 0 8px;"><strong>Mensaje:</strong> ${content}</p>
     <p style="margin:0;"><strong>Solicitud:</strong> ${requestDescription}</p>`,
  );
}

export function reviewReceivedTemplate(
  reviewedName: string,
  rating: number,
  comment: string,
  jobDescription: string,
): string {
  const safeComment = comment.trim() || "Sin comentario adicional.";

  return emailLayout(
    "Tienes una nueva resena",
    `<p style="margin:0 0 12px;">Hola ${reviewedName},</p>
     <p style="margin:0 0 8px;">Recibiste una calificacion de <strong>${rating}/5</strong>.</p>
     <p style="margin:0 0 8px;"><strong>Comentario:</strong> ${safeComment}</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${jobDescription}</p>`,
  );
}

export function badgeDescription(type: string): string {
  if (type === "VERIFICADO") {
    return "Perfil con identidad verificada en ITIW Connect.";
  }
  if (type === "NUEVO_TALENTO") {
    return "Profesional con sus primeros trabajos completados y buen desempeno.";
  }
  if (type === "TOP_RATED") {
    return "Calificacion sobresaliente y reputacion alta en la plataforma.";
  }
  if (type === "EXPERTO") {
    return "Profesional con experiencia comprobada en alto volumen de trabajos.";
  }
  return "Reconocimiento especial dentro de ITIW Connect.";
}

export function badgeAwardedTemplate(name: string, badgeType: string): string {
  const description = badgeDescription(badgeType);

  return emailLayout(
    "Obtuviste un nuevo badge",
    `<p style="margin:0 0 12px;">Hola ${name},</p>
     <p style="margin:0 0 8px;">Se asigno un nuevo reconocimiento en tu perfil profesional.</p>
     <p style="margin:0 0 8px;"><strong>Badge:</strong> ${badgeType}</p>
     <p style="margin:0;"><strong>Detalle:</strong> ${description}</p>`,
  );
}

export function rateExperienceTemplate(jobDescription: string, rateUrl: string): string {
  return emailLayout(
    "Califica tu experiencia",
    `<p style="margin:0 0 12px;">El trabajo ya fue completado y el pago se encuentra liberado.</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${jobDescription}</p>`,
    "Calificar ahora",
    rateUrl,
  );
}

export function notificationEventTemplate(title: string, body: string): string {
  return emailLayout(
    title,
    `<p style="margin:0;">${body}</p>`,
  );
}

export function disputeOpenedTemplate(
  openedByName: string,
  reason: string,
  description: string,
  jobDescription: string,
): string {
  return emailLayout(
    "Nueva disputa abierta",
    `<p style="margin:0 0 10px;"><strong>Abierta por:</strong> ${openedByName}</p>
     <p style="margin:0 0 10px;"><strong>Motivo:</strong> ${reason}</p>
     <p style="margin:0 0 10px;"><strong>Detalle:</strong> ${description}</p>
     <p style="margin:0;"><strong>Trabajo:</strong> ${jobDescription}</p>`,
  );
}
