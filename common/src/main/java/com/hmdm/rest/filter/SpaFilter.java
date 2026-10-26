package com.hmdm.rest.filter;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.FilterConfig;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public class SpaFilter implements Filter {

    // index.html with <base href> pointing to the context path, built on first use
    private volatile byte[] contextIndexHtml;

    @Override
    public void init(FilterConfig config) throws ServletException {
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestURI = httpRequest.getRequestURI();
        String contextPath = httpRequest.getContextPath();
        String path = requestURI.substring(contextPath.length());

        // Don't redirect REST API calls or static assets with extensions
        boolean passThrough = path.startsWith("/rest/") ||
                path.startsWith("/ws/") ||
                path.matches(".*\\.[a-zA-Z0-9]+$") ||
                path.matches("^/plugins/[a-zA-Z0-9_]*/rest/.*");

        // The front-end is built with <base href="/">, which only works at the server root.
        // Under a context path (e.g. /hmdm), index.html is sent with the context path as its base.
        if (!contextPath.isEmpty() && (!passThrough || path.equals("/index.html"))) {
            sendContextIndexHtml(httpRequest, (HttpServletResponse) response, contextPath);
        } else if (passThrough) {
            if (isUnhashedEntryFile(path)) {
                ((HttpServletResponse) response).setHeader("Cache-Control", "no-cache");
            }
            chain.doFilter(request, response);
        } else {
            // Redirect all other requests to index.html
            ((HttpServletResponse) response).setHeader("Cache-Control", "no-cache");
            request.getRequestDispatcher("/index.html").forward(request, response);
        }
    }

    // Files whose names stay the same from one build to the next but which name the build's hashed
    // chunks. Without Cache-Control, browsers cache them by heuristic and can load a new build's
    // main bundle with the previous build's federation manifest. Revalidating costs a 304
    private static boolean isUnhashedEntryFile(String path) {
        return path.equals("/index.html") ||
                path.endsWith("/remoteEntry.json") ||
                path.endsWith("/importmap.json") ||
                path.endsWith("/ngsw.json");
    }

    private void sendContextIndexHtml(HttpServletRequest request, HttpServletResponse response, String contextPath)
            throws IOException {
        byte[] content = contextIndexHtml;
        if (content == null) {
            try (InputStream in = request.getServletContext().getResourceAsStream("/index.html")) {
                if (in == null) {
                    response.sendError(HttpServletResponse.SC_NOT_FOUND);
                    return;
                }
                String html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                html = html.replaceFirst("<base href=\"[^\"]*\"", "<base href=\"" + contextPath + "/\"");
                content = html.getBytes(StandardCharsets.UTF_8);
                contextIndexHtml = content;
            }
        }
        response.setContentType("text/html;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache");
        response.setContentLength(content.length);
        if (!"HEAD".equalsIgnoreCase(request.getMethod())) {
            response.getOutputStream().write(content);
        }
    }

    @Override
    public void destroy() {
    }
}
