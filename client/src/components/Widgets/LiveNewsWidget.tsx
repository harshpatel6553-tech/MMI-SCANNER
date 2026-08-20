import React from 'react';

export function LiveNewsWidget() {
  const news = [
    {t:'10:48', h:'<b>Lupin</b> enters exclusive Europe license deal for YUVEZZITM, worth up to €75M'},
    {t:'10:27', h:'<b>Dev Information Tech</b> wins ₹5.15 Cr NICSI order for IFMS 3.0'},
    {t:'10:03', h:'<b>L&T</b> wins large infra contract, value ₹25B–50B'},
    {t:'09:53', h:'<b>Unicommerce</b> & Urban Co expand into UAE and Saudi Arabia'}
  ];

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Live News</span>
        <a className="card-link" href="#">All news →</a>
      </div>
      <div>
        {news.map((n, i) => (
          <div className="news-row" key={i}>
            <span className="news-dot"></span>
            <span className="news-time num">{n.t}</span>
            <span className="news-text" dangerouslySetInnerHTML={{__html: n.h}}></span>
          </div>
        ))}
      </div>
    </div>
  );
}
