import "./Home.css";

function Home({ navegar }) {
    return (
        <div className="home">

            <section className="home-hero">
                <div className="home-decoracion home-decoracion-uno" />
                <div className="home-decoracion home-decoracion-dos" />

                <div className="home-hero-contenido">

                    <div className="home-etiqueta">
                        <span className="home-etiqueta-punto" />
                        UN HOGAR LLENO DE CARIÑO
                    </div>

                    <h1 className="home-titulo">
                        Un lugar donde
                        <br />
                        el amor se siente
                        <br />
                        <em>como en casa.</em>
                    </h1>

                    <p className="home-descripcion">
                        En Casa Amandita creemos que cada historia merece
                        ser escuchada, cada sonrisa valorada y cada persona
                        acompañada con dignidad, respeto y mucho amor.
                    </p>

                    <div className="home-acciones">

                        <a className="home-boton-secundario" href="#sobre-nosotros">
                            Conócenos
                            <span aria-hidden="true">↓</span>
                        </a>
                    </div>
                    {/* esta parte no me convence si lo ven raro lo quitan xfa */}
                    <span className="home-detalle-corazon" aria-hidden="true">
                        ♡
                    </span>

                </div>
            </section>

            <section className="home-banner-seccion">
                <div className="home-banner-marco">
                    <img src="/images/banner-amandita.jpg"
                        alt="Casa Amandita del Adulto Mayor: dignidad, respeto y amor que se sienten como en casa"
                        className="home-banner-imagen" />
                </div>
            </section>

            <section className="home-nosotros" id="sobre-nosotros">

                <div className="home-nosotros-decoracion" aria-hidden="true">
                    ✳
                </div>

                <div className="home-nosotros-contenido">

                    <span className="home-seccion-etiqueta">
                        ✦ UN POQUITO SOBRE NOSOTROS
                    </span>

                    <h2>
                        Más que una casa,
                        <br />
                        <em>una familia.</em>
                    </h2>

                    <p>
                        Casa Amandita del Adulto Mayor es una organización
                        dedicada a brindar ayuda integral gratuita a
                        personas adultas mayores vulnerables o en
                        situación de calle.
                    </p>

                    <p>
                        Trabajamos para construir un ambiente cálido,
                        humano y seguro, donde el bienestar y el cariño
                        estén presentes cada día.
                    </p>

                    <div className="home-nosotros-valores">
                        <span>Dignidad</span>
                        <span>Respeto</span>
                        <span>Amor</span>
                    </div>

                </div>

                <div className="home-nosotros-tarjeta">
                    <div className="home-tarjeta-circulo">
                        <span>.ೀ</span>
                    </div>

                    {/*Cambien esta parte no se q poner akjsbdakjsd */}
                    <span className="home-tarjeta-subtitulo">
                        NUESTRO PENSAR
                    </span>

                    <h3>
                        Pequeños gestos,
                        <br />
                        grandes sonrisas.
                    </h3>

                    <p>
                        Porque todos merecemos sentirnos acompañados,
                        valorados y queridos.
                    </p>

                    <div className="home-tarjeta-flores" aria-hidden="true">
                        ⋆౨ৎ˚⟡˖ ࣪

                    </div>
                </div>
            </section>

            <div className="home-cierre">
                Hecho por astralabs o no se ayuda askjdjasd
                <span aria-hidden="true"> ⊹₊˚‧︵‿₊୨ᰔ୧₊‿︵‧˚₊⊹ </span>
            </div>

        </div>
    );
}

export default Home;